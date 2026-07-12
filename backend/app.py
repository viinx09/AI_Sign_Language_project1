from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import threading

# Get the directory of the current file (app.py)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

app = Flask(__name__, template_folder=os.path.join(PROJECT_ROOT, 'frontend', 'templates'), 
            static_folder=os.path.join(PROJECT_ROOT, 'frontend', 'static'))
CORS(app)

DATABASE_PATH = os.path.join(PROJECT_ROOT, 'database', 'sign_language.db')

# Don't initialize pyttsx3 here - it might cause issues; do it inside speak()

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()
    
    # Create the table first!
    c.execute('''CREATE TABLE IF NOT EXISTS gestures
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  gesture_name TEXT NOT NULL,
                  description TEXT,
                  language TEXT DEFAULT "isl",
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Now check if language column exists (in case table existed before without it)
    c.execute("PRAGMA table_info(gestures)")
    columns = [col[1] for col in c.fetchall()]
    
    if 'language' not in columns:
        try:
            c.execute('ALTER TABLE gestures ADD COLUMN language TEXT DEFAULT "isl"')
        except Exception as e:
            print(f"Note: Could not add language column: {e}")
    
    conn.commit()
    conn.close()

database_dir = os.path.join(PROJECT_ROOT, 'database')
if not os.path.exists(database_dir):
    os.makedirs(database_dir)
init_db()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/detection')
def detection():
    return render_template('detection.html')

@app.route('/translation')
def translation():
    return render_template('translation.html')

@app.route('/dataset')
def dataset():
    return render_template('dataset.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/api/gestures', methods=['GET', 'POST'])
def gestures():
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO gestures (gesture_name, description, language) VALUES (?, ?, ?)',
                  (data['gesture_name'], data.get('description', ''), data.get('language', 'isl')))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Gesture added successfully!'}), 201
    
    # Get language from query parameter, default to 'isl'
    language = request.args.get('language', 'isl')
    c.execute('SELECT * FROM gestures WHERE language = ?', (language,))
    gestures = c.fetchall()
    conn.close()
    return jsonify(gestures)

def speak_text(text):
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.say(text)
        engine.runAndWait()
        engine.stop()
    except Exception as e:
        print(f"TTS Error: {e}")

@app.route('/api/speak', methods=['POST'])
def speak():
    data = request.json
    text = data.get('text', '')
    if text:
        # Run TTS in a separate thread to avoid blocking the server
        threading.Thread(target=speak_text, args=(text,), daemon=True).start()
    return jsonify({'success': True, 'message': f'Speech initiated: {text}'})

@app.route('/api/languages', methods=['GET'])
def get_languages():
    languages = [
        {'code': 'isl', 'name': 'Indian Sign Language (ISL)'},
        {'code': 'ben-sl', 'name': 'Bengali Sign Language'},
        {'code': 'hin-sl', 'name': 'Hindi Sign Language'},
        {'code': 'kan-sl', 'name': 'Kannada Sign Language'},
        {'code': 'tam-sl', 'name': 'Tamil Sign Language'},
        {'code': 'tel-sl', 'name': 'Telugu Sign Language'},
        {'code': 'mar-sl', 'name': 'Marathi Sign Language'}
    ]
    return jsonify(languages)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
