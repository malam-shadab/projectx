const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Update CORS configuration
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://malam-shadab.github.io',
        'https://projectx-api-malam-shadab-f485c3fe49cc.herokuapp.com'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());

app.get('/debug-env', (req, res) => {
    const hasKey = !!process.env.OPENAI_API_KEY;
    res.json({
        hasKey,
        nodeEnv: process.env.NODE_ENV,
        pwd: process.cwd()
    });
});

app.post('/analyze', async (req, res) => {
    try {
        if (!req.body.text?.trim()) {
            throw new Error('No text provided for analysis');
        }

        console.log('Processing request:', {
            textLength: req.body.text.length,
            hasApiKey: !!process.env.OPENAI_API_KEY
        });

        if (!process.env.OPENAI_API_KEY) {
            console.error('API Key missing in environment');
            throw new Error('OpenAI API key not configured');
        }

        console.log('Received analyze request:', {
            textLength: req.body.text?.length,
            timestamp: new Date().toISOString()
        });

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4",
            messages: [{
                role: "user",
                content: `Analyze the following text and provide a response in this exact JSON structure:
                {
                    "Grammar": {
                        "Analysis": "Detailed grammar analysis",
                        "Comments": ["Issue 1", "Issue 2"],
                        "CorrectedText": "Corrected version"
                    },
                    "Tone": {
                        "Analysis": "Tone analysis"
                    },
                    "Sentiment": {
                        "Analysis": "Sentiment analysis"
                    },
                    "Main Topics": {
                        "Analysis": "Topics overview",
                        "Topics": ["Topic 1", "Topic 2"]
                    },
                    "Professional Experience": {
                        "Analysis": "Experience analysis"
                    },
                    "Work Projects": {
                        "Analysis": "Projects analysis"
                    },
                    "Job Responsibilities": {
                        "Analysis": "Responsibilities analysis"
                    },
                    "Educational Qualifications": {
                        "Analysis": "Education analysis"
                    },
                    "Awards and Presentations": {
                        "Analysis": "Awards analysis"
                    },
                    "Technical Skills": {
                        "Analysis": "Skills analysis"
                    },
                    "Suggestions": {
                        "Analysis": "Suggestions overview",
                        "Topics": ["Suggestion 1", "Suggestion 2"]
                    }
                }

                Text to analyze: ${req.body.text}`
            }],
            temperature: 0.7,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Validate OpenAI response
        if (!response.data?.choices?.[0]?.message?.content) {
            console.error('Invalid OpenAI response:', response.data);
            throw new Error('Invalid response from OpenAI');
        }

        const content = response.data.choices[0].message.content;
        
        try {
            const parsedAnalysis = JSON.parse(content.trim());
            
            // Validate required fields
            if (!parsedAnalysis.Grammar || !parsedAnalysis.Suggestions) {
                throw new Error('Response missing required fields');
            }

            console.log('Analysis complete:', {
                hasGrammar: !!parsedAnalysis.Grammar,
                sections: Object.keys(parsedAnalysis)
            });

            res.json(parsedAnalysis);
        } catch (parseError) {
            console.error('JSON Parse error:', {
                error: parseError,
                content: content
            });
            throw new Error('Failed to parse OpenAI response');
        }

    } catch (error) {
        console.error('Server error:', {
            name: error.name,
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        
        res.status(500).json({
            error: error.message,
            details: error.response?.data?.error || 'Internal server error'
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Environment:', {
        hasApiKey: !!process.env.OPENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV
    });
});