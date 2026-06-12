from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
import sqlite3
import os
import pyttsx3

app = Flask(__name__, template_folder='../frontend/templates', static_folder='../frontend/static')
CORS(app)

DATABASE_PATH = '../database/sign_language.db'

tts_engine = pyttsx3.init()

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()
    
    # Check if language column exists, if not, add it (migration)
    c.execute("PRAGMA table_info(gestures)")
    columns = [col[1] for col in c.fetchall()]
    
    if 'language' not in columns:
        # Add language column if it doesn't exist
        c.execute('ALTER TABLE gestures ADD COLUMN language TEXT DEFAULT "isl"')
    
    c.execute('''CREATE TABLE IF NOT EXISTS gestures
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  gesture_name TEXT NOT NULL,
                  description TEXT,
                  language TEXT DEFAULT "isl",
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

if not os.path.exists('../database'):
    os.makedirs('../database')
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

@app.route('/api/speak', methods=['POST'])
def speak():
    data = request.json
    text = data.get('text', '')
    language = data.get('language', 'isl')
    
    # Map language codes to pyttsx3 voices (this may vary by system)
    try:
        voices = tts_engine.getProperty('voices')
        
        # Try to match language, fallback to default
        selected_voice = None
        for voice in voices:
            if language in voice.languages[0].lower():
                selected_voice = voice
                break
        
        if selected_voice:
            tts_engine.setProperty('voice', selected_voice.id)
        
        if text:
            tts_engine.say(text)
            tts_engine.runAndWait()
            return jsonify({'success': True, 'message': 'Speech completed'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    return jsonify({'success': False, 'message': 'No text provided'}), 400

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
