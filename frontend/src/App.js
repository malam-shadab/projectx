import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { configurePdfWorker } from './pdfWorkerConfig';
import { jsPDF } from "jspdf";
import './App.css';
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
    const [text, setText] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [editedAnalysis, setEditedAnalysis] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                await configurePdfWorker();
                console.log('PDF Worker initialized successfully');
            } catch (error) {
                console.error('PDF Worker initialization failed:', error);
                setError('Failed to initialize PDF processor');
            }
        };

        initializeApp();
    }, []); // Empty dependency array for one-time initialization

    useEffect(() => {
        return () => {
            // Cleanup when component unmounts
            if (pdfjsLib.GlobalWorkerOptions.workerPort) {
                pdfjsLib.GlobalWorkerOptions.workerPort.terminate();
            }
        };
    }, []);

    useEffect(() => {
        if (analysis) {
            setEditedAnalysis(JSON.parse(JSON.stringify(analysis))); // Deep copy
        }
    }, [analysis]);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setError(null);
            if (file.type === 'application/pdf') {
                const extractedText = await extractPDFText(file);
                setText(sanitizeText(extractedText));
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    setText(sanitizeText(content));
                };
                reader.readAsText(file);
            }
        } catch (error) {
            console.error('File processing error:', error);
            setError(`Error reading file: ${error.message}`);
        }
    };

    const extractPDFText = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            return fullText.trim();
        } catch (error) {
            console.error('PDF processing error:', error);
            throw new Error('Failed to process PDF file. Please make sure it\'s a valid PDF document.');
        }
    };

    const sanitizeText = (text) => {
        if (!text) return '';
        return text
            .replace(/[^\x20-\x7E\s]/g, '') // Only keep printable ASCII characters and whitespace
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .trim();
    };

    const analyzeText = async () => {
        try {
            setIsAnalyzing(true);
            setError(null);

            console.log('Making request to:', process.env.REACT_APP_API_URL); // Debug log

            const response = await axios.post(`${process.env.REACT_APP_API_URL}/analyze`, {
                text: text
            });

            console.log('Response:', response.data); // Debug log

            const parsedAnalysis = JSON.parse(response.data.choices[0].message.content);
            setAnalysis(parsedAnalysis);
        } catch (error) {
            console.error('Frontend error:', error);
            setError(error.response?.data?.error || 'Failed to analyze text');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalysisEdit = (section, value, type = 'text') => {
        if (!editedAnalysis) return;
        
        setEditedAnalysis(prev => {
            const updated = { ...prev };
            if (section === 'Grammar') {
                if (type === 'comments') {
                    updated.Grammar.Comments = value;
                } else {
                    updated.Grammar.CorrectedText = value;
                }
            } else if (section === 'Suggestions') {
                updated["Suggestions"].Topics = value;
            } else {
                updated[section].Analysis = value;
            }
            return updated;
        });
    };

    const downloadAsPDF = () => {
        if (!editedAnalysis) return;

        const doc = new jsPDF();
        let yPos = 20;
        const lineHeight = 10;
        const margin = 20;
        const pageWidth = doc.internal.pageSize.width;

        // Helper function to safely convert to string and split text
        const safeTextSplit = (text) => {
            const str = String(text || ''); // Convert to string, use empty string if null/undefined
            return doc.splitTextToSize(str, pageWidth - margin * 2);
        };

        // Title
        doc.setFontSize(16);
        doc.text('Text Analysis Report', margin, yPos);
        yPos += lineHeight * 2;

        // Sections
        doc.setFontSize(12);
        Object.entries(editedAnalysis).forEach(([section, content]) => {
            // Check if we need a new page
            if (yPos > doc.internal.pageSize.height - margin) {
                doc.addPage();
                yPos = margin;
            }

            // Section title
            doc.setFont(undefined, 'bold');
            doc.text(section, margin, yPos);
            yPos += lineHeight;

            // Section content
            doc.setFont(undefined, 'normal');
            if (section === 'Grammar') {
                if (Array.isArray(content.Comments)) {
                    doc.text('Issues Found:', margin, yPos);
                    yPos += lineHeight;
                    content.Comments.forEach(comment => {
                        const lines = safeTextSplit(`• ${comment}`);
                        doc.text(lines, margin, yPos);
                        yPos += lineHeight * lines.length;
                    });
                }
                
                if (content.CorrectedText) {
                    yPos += lineHeight;
                    doc.text('Corrected Text:', margin, yPos);
                    yPos += lineHeight;
                    const correctedLines = safeTextSplit(content.CorrectedText);
                    doc.text(correctedLines, margin, yPos);
                    yPos += lineHeight * correctedLines.length;
                }
            } else if (section === 'Suggestions' && Array.isArray(content.Topics)) {
                content.Topics.forEach(topic => {
                    const lines = safeTextSplit(`• ${topic}`);
                    doc.text(lines, margin, yPos);
                    yPos += lineHeight * lines.length;
                });
            } else if (content.Analysis) {
                const lines = safeTextSplit(content.Analysis);
                doc.text(lines, margin, yPos);
                yPos += lineHeight * lines.length;
            }
            
            yPos += lineHeight;
        });

        doc.save('text-analysis-report.pdf');
    };

    const renderAnalysisSection = (title, content, type = 'default') => {
        if (!content || !editedAnalysis) return null;
        
        return (
            <div className="analysis-section fade-in">
                <h4>{title}</h4>
                <div className="section-content">
                    {type === 'grammar' ? (
                        <>
                            <div className="grammar-issues">
                                <h5>Issues Found:</h5>
                                <ul>
                                    {editedAnalysis.Grammar.Comments.map((item, index) => (
                                        <li key={index}>
                                            <textarea
                                                value={item}
                                                onChange={(e) => {
                                                    const newComments = [...editedAnalysis.Grammar.Comments];
                                                    newComments[index] = e.target.value;
                                                    handleAnalysisEdit('Grammar', newComments, 'comments');
                                                }}
                                                className="editable-content"
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="corrected-text">
                                <h5>Corrected Text:</h5>
                                <textarea
                                    value={editedAnalysis.Grammar.CorrectedText}
                                    onChange={(e) => handleAnalysisEdit('Grammar', e.target.value)}
                                    className="editable-content"
                                    rows="4"
                                />
                            </div>
                        </>
                    ) : type === 'suggestions' ? (
                        <ul>
                            {editedAnalysis.Suggestions.Topics.map((topic, index) => (
                                <li key={index}>
                                    <textarea
                                        value={topic}
                                        onChange={(e) => {
                                            const newTopics = [...editedAnalysis["Main Topics"].Topics];
                                            newTopics[index] = e.target.value;
                                            handleAnalysisEdit('Main Topics', newTopics);
                                        }}
                                        className="editable-content"
                                    />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <textarea
                            value={editedAnalysis[title].Analysis}
                            onChange={(e) => handleAnalysisEdit(title, e.target.value)}
                            className="editable-content"
                            rows="4"
                        />
                    )}
                </div>
            </div>
        );
    };

    return (
        <Router basename="/projectx">
            <div className="App">
                <div className="App-header">
                    <h1>Text Analysis App</h1>
                    <div className="analysis-container">
                        <div className="input-controls">
                            <textarea
                                placeholder="Enter your text here..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="text-input"
                                rows="6"
                            />
                            <div className="button-group">
                                <button 
                                    onClick={analyzeText}
                                    disabled={isAnalyzing}
                                    className={isAnalyzing ? 'analyzing' : ''}
                                >
                                    {isAnalyzing ? 'Analyzing...' : 'Analyze Text'}
                                </button>
                                <button 
                                    onClick={() => fileInputRef.current.click()}
                                    className="upload-btn"
                                >
                                    Upload Document
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".txt,.pdf"
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </div>
                        {error && (
                            <div className="error-message fade-in">
                                {error}
                            </div>
                        )}
                        {analysis && (
                            <div className="results-container fade-in">
                                <h3>Analysis Results</h3>
                                {renderAnalysisSection("Grammar", analysis.Grammar, 'grammar')}
                                {renderAnalysisSection("Tone", analysis.Tone)}
                                {renderAnalysisSection("Sentiment", analysis.Sentiment)}
                                {renderAnalysisSection("Main Topics", analysis["Main Topics"], 'topics')}
                                {renderAnalysisSection("Professional Experience", analysis["Professional Experience"])}
                                {renderAnalysisSection("Work Projects", analysis["Work Projects"])}
                                {renderAnalysisSection("Job Responsibilities", analysis["Job Responsibilities"])}
                                {renderAnalysisSection("Educational Qualifications", analysis["Educational Qualifications"])}
                                {renderAnalysisSection("Awards and Presentations", analysis["Awards and Presentations"])}
                                {renderAnalysisSection("Technical Skills", analysis["Technical Skills"])}
                                {renderAnalysisSection("Suggestions", analysis.Suggestions, 'suggestions')}
                                <button 
                                    onClick={downloadAsPDF}
                                    className="download-btn"
                                >
                                    Download Report as PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Router>
    );
}

export default App;