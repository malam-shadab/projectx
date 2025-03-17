import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import { configurePdfWorker } from './pdfWorkerConfig';
import { jsPDF } from "jspdf";
import { BrowserRouter as Router } from 'react-router-dom';
import { scaleOrdinal } from 'd3-scale';
import { schemeSet3 } from 'd3-scale-chromatic';
import { rgb } from 'd3-color';
import html2canvas from 'html2canvas';
import AnalysisGraph from './components/AnalysisGraph';
import './App.css';

const App = () => {
    const [text, setText] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [editedAnalysis, setEditedAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const fileInputRef = useRef(null);

    const initializeApp = async () => {
        try {
            await configurePdfWorker();
            console.log('PDF Worker initialized successfully');
        } catch (error) {
            console.error('PDF Worker initialization failed:', error);
            setError('Failed to initialize PDF processor');
        }
    };

    useEffect(() => {
        initializeApp();
        return () => {
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
        return text.replace(/[^\x20-\x7E\s]/g, '') // Only keep printable ASCII characters and whitespace
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    };

    const analyzeText = async () => {
        setIsAnalyzing(true);
        setError(null);
        try {
            console.log('Sending analysis request:', {
                apiUrl: process.env.REACT_APP_API_URL,
                textLength: text?.length
            });
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/analyze`, {
                text
            });
            console.log('Analysis response received:', {
                status: response.status,
                data: response.data
            });
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

    const handleContentChange = (section, value, type = 'text') => {
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
            const margin = 20;
            const lineHeight = 7;
            const pageWidth = pdf.internal.pageSize.width;
            let yPos = 20;

            const addColoredSection = (title, content, color) => {
                // Calculate content height first
                let contentHeight = 0;
                if (typeof content === 'string') {
                    const lines = pdf.splitTextToSize(content, pageWidth - 2 * margin);
                    contentHeight = lineHeight * lines.length;
                } else if (Array.isArray(content)) {
                    content.forEach(item => {
                        const lines = pdf.splitTextToSize('• ' + item, pageWidth - 2 * margin);
                        contentHeight += lineHeight * lines.length;
                    });
                }

                // Set section background with padding
                const sectionPadding = 15;
                const totalHeight = contentHeight + sectionPadding * 2;
                
                // Set background color
                const rgbColor = [
                    Math.round(color.r),
                    Math.round(color.g),
                    Math.round(color.b)
                ];
                
                pdf.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
                pdf.setGState(new pdf.GState({ opacity: 0.1 }));
                pdf.rect(margin - 10, yPos - 5, pageWidth - 2 * (margin - 10), totalHeight, 'F');
                pdf.setGState(new pdf.GState({ opacity: 1 }));
                
                // Add title
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(44, 62, 80);
                pdf.text(title, margin, yPos + 10);
                yPos += 20;

                // Add content
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(44, 62, 80);
                
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

            // Add sections with colors
            Object.entries(editedAnalysis).forEach(([section, content], index) => {
                const color = rgb(schemeSet3[index]);
                
                if (yPos > pdf.internal.pageSize.height - 40) {
                    pdf.addPage();
                    yPos = 20;
                }
                
                addColoredSection(section, 
                    section === 'Grammar' 
                        ? [...(content.Comments || []), '', content.CorrectedText] 
                        : content.Analysis || content.Topics || [], 
                    color
                );
            });

            // Add new page for graph and strengths
            pdf.addPage();
            yPos = 20;

            // Add graph heading
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(44, 62, 80);
            pdf.text('Relationship Graph', margin, yPos);
            yPos += 15;

            // Capture and add graph
            const graphContainer = document.querySelector('.graph-container canvas');
            if (graphContainer) {
                try {
                    const graphImage = await html2canvas(graphContainer);
                    const imgData = graphImage.toDataURL('image/png');
                    const imgWidth = pageWidth - (2 * margin);
                    const imgHeight = (graphImage.height * imgWidth) / graphImage.width;
                    
                    pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 20;
                } catch (error) {
                    console.error('Error capturing graph:', error);
                }
            }

            // Add strength analysis
            pdf.setFont('helvetica', 'bold');
            pdf.text('Relationship Strengths', margin, yPos);
            yPos += 15;

            // Capture and add strengths
            const strengthsContainer = document.querySelector('.top-pairs-analysis');
            if (strengthsContainer) {
                pdf.setFont('helvetica', 'normal');
                const strengths = Array.from(strengthsContainer.querySelectorAll('li'))
                    .map(li => '• ' + li.textContent.trim());
                
                strengths.forEach(strength => {
                    const lines = pdf.splitTextToSize(strength, pageWidth - 2 * margin);
                    pdf.text(lines, margin, yPos);
                    yPos += lineHeight * lines.length;
                });
            }

            // Generate timestamp and save
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .replace('T', '_')
                .slice(0, -5);

            pdf.save(`analysis-report_${timestamp}.pdf`);
        } catch (error) {
            console.error('PDF generation error:', error);
            setError('Failed to generate PDF');
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
};

export default App;
