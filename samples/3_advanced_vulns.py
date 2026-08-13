import subprocess
import yaml
import requests
from flask import Flask, request, render_template_string

app = Flask(__name__)
DEBUG = True # OWASP: Debug enabled in production

@app.route("/execute")
def execute_script():
    # OWASP A03:2021 - Arbitrary Command Injection
    script_name = request.args.get("script")
    result = subprocess.check_output(script_name, shell=True)
    return result

@app.route("/load")
def load_config():
    # OWASP A08:2021 - Insecure Deserialization
    yaml_data = request.args.get("data")
    config = yaml.load(yaml_data)
    return str(config)

@app.route("/fetch")
def fetch_url():
    # SSRF (Server-Side Request Forgery) + Missing SSL Verification
    target_url = request.args.get("url")
    response = requests.get(target_url, verify=False)
    
    # OWASP A03:2021 - XSS via template rendering
    template = f"<h1>Fetched Content from {target_url}</h1><p>{response.text}</p>"
    return render_template_string(template)

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=DEBUG)
