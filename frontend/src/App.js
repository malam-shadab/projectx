import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { configurePdfWorker } from './pdfWorkerConfig';
import { jsPDF } from "jspdf";
import './App.css';
import { BrowserRouter as Router } from 'react-router-dom';
import AnalysisGraph from './components/AnalysisGraph';
import html2canvas from 'html2canvas';
import { scaleOrdinal } from 'd3-scale';
import { schemeSet3 } from 'd3-scale-chromatic';
import { rgb } from 'd3-color'; // Add this import

function App() {
    const [text, setText] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [editedAnalysis, setEditedAnalysis] = useState(null);
    const fileInputRef = useRef(null);
    const graphRef = useRef();

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

            console.log('Sending analysis request:', {
                apiUrl: process.env.REACT_APP_API_URL,
                textLength: text?.length
            });

            const response = await axios.post(`${process.env.REACT_APP_API_URL}/analyze`, {
                text: text
            });

            console.log('Response received:', {
                status: response.status,
                data: response.data
            });

            // No need to parse, backend already sends parsed JSON
            setAnalysis(response.data);

        } catch (error) {
            console.error('Frontend error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
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

    const downloadAsPDF = async () => {
        try {
            const pdf = new jsPDF();
            let yPos = 20;
            const margin = 20;
            const lineHeight = 7;
            const pageWidth = pdf.internal.pageSize.width;

            const addColoredSection = (title, content, color) => {
                // Convert RGB values to 0-1 range for PDF
                const rgbColor = color.map(c => Math.min(c, 1));
                
                // Set section background color
                pdf.setFillColor(...rgbColor);
                pdf.rect(margin - 5, yPos - 5, pageWidth - 2 * (margin - 5), 30, 'F');
                
                // Set title color based on background brightness
                const brightness = (rgbColor[0] * 299 + rgbColor[1] * 587 + rgbColor[2] * 114) / 1000;
                pdf.setTextColor(brightness > 0.5 ? 0 : 255);
                pdf.setFont('helvetica', 'bold');
                pdf.text(title, margin, yPos + 5);
                yPos += 15;

                // Reset text color for content
                pdf.setTextColor(44, 62, 80);
                pdf.setFont('helvetica', 'normal');
                
                // Add content in dark gray
                if (typeof content === 'string') {
                    const lines = pdf.splitTextToSize(content, pageWidth - 2 * margin);
                    pdf.text(lines, margin, yPos);
                    yPos += lineHeight * lines.length;
                } else if (Array.isArray(content)) {
                    content.forEach(item => {
                        const bulletPoint = '• ' + item;
                        const lines = pdf.splitTextToSize(bulletPoint, pageWidth - 2 * margin);
                        pdf.text(lines, margin, yPos);
                        yPos += lineHeight * lines.length;
                    });
                }
                yPos += 10;
            };

            // Add sections with proper colors
            Object.entries(editedAnalysis).forEach(([section, content], index) => {
                const color = rgb(schemeSet3[index]);
                const rgbColor = [color.r/255, color.g/255, color.b/255];
                
                if (yPos > pdf.internal.pageSize.height - 40) {
                    pdf.addPage();
                    yPos = 20;
                }
                
                addColoredSection(section, 
                    section === 'Grammar' 
                        ? [...(content.Comments || []), '', content.CorrectedText] 
                        : content.Analysis || content.Topics || [], 
                    rgbColor
                );
            });

            // Generate timestamp string
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .replace('T', '_')
                .slice(0, -5); // Remove milliseconds and timezone

            // Save PDF with timestamp
            pdf.save(`analysis-report_${timestamp}.pdf`);
        } catch (error) {
            console.error('PDF generation error:', error);
        }
    };

    const renderAnalysisSection = (title, content, type = 'default') => {
        if (!content || !editedAnalysis) return null;
        
        const handleContentChange = (e) => {
            const updatedContent = { ...editedAnalysis[title] };
            if (type === 'grammar') {
                if (e.target.dataset.type === 'comment') {
                    updatedContent.Comments = e.target.value.split('\n').filter(line => line.trim());
                } else {
                    updatedContent.CorrectedText = e.target.value;
                }
            } else if (type === 'topics' || type === 'suggestions') {
                if (e.target.dataset.type === 'topics') {
                    updatedContent.Topics = e.target.value.split('\n').filter(line => line.trim());
                }
                if (content.Analysis) {
                    updatedContent.Analysis = content.Analysis;
                }
            } else {
                updatedContent.Analysis = e.target.value;
            }
            
            setEditedAnalysis({
                ...editedAnalysis,
                [title]: updatedContent
            });
        };
        
        return (
            <div 
                className="analysis-section fade-in"
                data-section={title}
            >
                <h4>{title}</h4>
                <div className="section-content">
                    {type === 'grammar' ? (
                        <>
                            <textarea
                                className="editable-content"
                                data-type="comment"
                                value={content.Comments?.join('\n')}
                                onChange={handleContentChange}
                                placeholder="Comments..."
                            />
                            <textarea
                                className="editable-content"
                                value={content.CorrectedText}
                                onChange={handleContentChange}
                                placeholder="Corrected text..."
                            />
                        </>
                    ) : type === 'topics' ? (
                        <textarea
                            className="editable-content"
                            data-type="topics"
                            value={content.Topics?.join('\n')}
                            onChange={handleContentChange}
                            placeholder="Topics..."
                        />
                    ) : type === 'suggestions' ? (
                        <textarea
                            className="editable-content"
                            data-type="topics"
                            value={content.Topics?.join('\n')}
                            onChange={handleContentChange}
                            placeholder="Suggestions..."
                        />
                    ) : (
                        <textarea
                            className="editable-content"
                            value={content.Analysis}
                            onChange={handleContentChange}
                            placeholder="Analysis..."
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
                                <AnalysisGraph analysis={analysis} />
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