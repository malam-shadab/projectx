from utils.similarity import calculate_entity_similarities
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure for both environments
if os.environ.get('FLASK_ENV') == 'development':
    app.config['DEBUG'] = True
else:
    app.config['DEBUG'] = False

@app.route('/analyze', methods=['POST'])
def analyze_text():
    try:
        text = request.json.get('text', '')
        
        # ... your existing analysis code ...
        
        # Extract entities from your analysis results
        entities = []
        for section in analysis_results:
            if isinstance(section.get('Topics'), list):
                entities.extend(section['Topics'])
            elif isinstance(section.get('Analysis'), str):
                # Extract key phrases from Analysis sections
                entities.extend(extract_key_phrases(section['Analysis']))
        
        # Calculate similarities
        similarities = calculate_entity_similarities(entities)
        
        # Add similarities to your graph data
        for sim in similarities:
            analysis_results['links'].append({
                'source': sim['source'],
                'target': sim['target'],
                'value': sim['similarity']
            })
        
        return jsonify(analysis_results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if os.environ.get('FLASK_ENV') == 'development':
        # Local development
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), debug=True)
    else:
        # Production/Heroku
        from waitress import serve
        serve(app, host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))