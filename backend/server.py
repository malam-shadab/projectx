from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allows requests from React frontend

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.json  # Get data from frontend
    num1 = data.get("num1", 0)
    num2 = data.get("num2", 0)

    # Perform calculations
    sum_result = num1 + num2
    product_result = num1 * num2

    return jsonify({
        "sum": sum_result,
        "product": product_result
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
