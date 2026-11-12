import { SampleCode } from '../types/security';

export const SAMPLE_CODES: SampleCode[] = [
  {
    id: 'python-flask-sqli-rce',
    title: 'Python Flask: User Auth & File Fetcher',
    language: 'python',
    fileName: 'user_service.py',
    category: 'Injection & Hardcoded Secrets',
    description: 'A Flask backend with raw SQL string formatting, shell command execution, and hardcoded JWT secrets.',
    expectedVulnerabilities: ['CWE-89: SQL Injection', 'CWE-78: OS Command Injection', 'CWE-798: Hardcoded Secret Key'],
    code: `from flask import Flask, request, jsonify
import sqlite3
import os
import jwt

app = Flask(__name__)

# SECURITY ISSUE: Hardcoded production secret
JWT_SECRET = "super_secret_production_key_12345"
DATABASE_URI = "production_users.db"

@app.route("/api/user", methods=["GET"])
def get_user():
    username = request.args.get("username")
    conn = sqlite3.connect(DATABASE_URI)
    cursor = conn.cursor()
    
    # SECURITY ISSUE: Raw SQL string formatting allows SQL Injection
    query = f"SELECT id, username, email, role FROM users WHERE username = '{username}'"
    cursor.execute(query)
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({"id": user[0], "username": user[1], "role": user[3]})

@app.route("/api/ping-host", methods=["POST"])
def ping_host():
    data = request.json or {}
    target_host = data.get("host", "127.0.0.1")
    
    # SECURITY ISSUE: Direct shell invocation with unsanitized user input
    command = f"ping -c 2 {target_host}"
    output = os.popen(command).read()
    
    return jsonify({"status": "complete", "output": output})

if __name__ == "__main__":
    # Insecure debug mode in production
    app.run(debug=True, host="0.0.0.0", port=5000)
`
  },
  {
    id: 'nodejs-express-ssrf-xss',
    title: 'Node.js Express: Document Proxy & Profile',
    language: 'javascript',
    fileName: 'documentController.js',
    category: 'SSRF & Reflected XSS',
    description: 'An Express controller with Server-Side Request Forgery (SSRF) and unsanitized HTML output reflection.',
    expectedVulnerabilities: ['CWE-918: Server-Side Request Forgery', 'CWE-79: Cross-Site Scripting (XSS)', 'CWE-22: Path Traversal'],
    code: `const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Proxy an external document by URL
router.get('/proxy-document', async (req, res) => {
  const { url } = req.query;
  
  try {
    // SECURITY ISSUE: Unvalidated URL allows SSRF to internal metadata endpoints (169.254.169.254)
    const response = await axios.get(url, { timeout: 3000 });
    res.setHeader('Content-Type', response.headers['content-type'] || 'text/plain');
    return res.send(response.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Download user export file
router.get('/export-file', (req, res) => {
  const { filename } = req.query;
  
  // SECURITY ISSUE: Insecure path concatenation allows Directory Traversal (../../etc/passwd)
  const filePath = path.join(__dirname, 'public/exports', filename);
  
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    res.send(fileContent);
  } else {
    res.status(404).send('File not found');
  }
});

// Render user profile welcome banner
router.get('/welcome', (req, res) => {
  const name = req.query.name || 'Guest';
  
  // SECURITY ISSUE: Reflected Cross-Site Scripting (XSS) via raw HTML concatenation
  res.send('<html><body><h1>Welcome back, ' + name + '!</h1></body></html>');
});

module.exports = router;
`
  },
  {
    id: 'golang-path-traversal-auth',
    title: 'Go: File Server & Session Validator',
    language: 'go',
    fileName: 'fileserver.go',
    category: 'Broken Access Control & Path Traversal',
    description: 'Go HTTP handler reading files directly from query strings with no path boundary checks.',
    expectedVulnerabilities: ['CWE-22: Path Traversal', 'CWE-338: Insecure Randomness'],
    code: `package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"time"
)

// Insecure pseudo-random generator seeded with current time
func generateSessionToken() string {
	rand.Seed(time.Now().UnixNano())
	token := fmt.Sprintf("%016x", rand.Int63())
	return token
}

func handleFileDownload(w http.ResponseWriter, r *http.Request) {
	docName := r.URL.Query().Get("file")
	if docName == "" {
		http.Error(w, "Missing file parameter", http.StatusBadRequest)
		return
	}

	// SECURITY ISSUE: Path traversal allows arbitrary file read (/etc/shadow or secrets)
	fullPath := "/var/app/data/" + docName
	data, err := os.ReadFile(fullPath)
	if err != nil {
		http.Error(w, "Could not read file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(data)
}

func main() {
	http.HandleFunc("/download", handleFileDownload)
	http.ListenAndServe(":8080", nil)
}
`
  },
  {
    id: 'java-spring-deserialization',
    title: 'Java Spring: Insecure Object Deserialization',
    language: 'java',
    fileName: 'SessionCacheManager.java',
    category: 'Insecure Deserialization',
    description: 'Java stream processing using standard ObjectInputStream without filter checks.',
    expectedVulnerabilities: ['CWE-502: Deserialization of Untrusted Data'],
    code: `package com.patchproof.service;

import java.io.ByteArrayInputStream;
import java.io.ObjectInputStream;
import java.util.Base64;
import org.springframework.stereotype.Service;

@Service
public class SessionCacheManager {

    /**
     * Reconstructs serialized session state from an incoming base64 payload.
     * VULNERABILITY: ObjectInputStream allows remote code execution if gadgets exist.
     */
    public Object deserializeSession(String rawPayload) throws Exception {
        byte[] bytes = Base64.getDecoder().decode(rawPayload);
        
        // SECURITY ISSUE: Insecure Java deserialization of untrusted user input (CWE-502)
        try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
             ObjectInputStream ois = new ObjectInputStream(bais)) {
            
            return ois.readObject();
        }
    }
}
`
  },
  {
    id: 'php-insecure-eval',
    title: 'PHP: Dynamic Template Engine & File Upload',
    language: 'php',
    fileName: 'renderer.php',
    category: 'Code Evaluation & Arbitrary File Upload',
    description: 'PHP script evaluating formulas using eval() and accepting file uploads without extension checks.',
    expectedVulnerabilities: ['CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code (Eval Injection)', 'CWE-434: Unrestricted Upload of File with Dangerous Type'],
    code: `<?php
// Dynamic mathematical formula calculator
$formula = $_GET['calc'] ?? '1 + 1';

// SECURITY ISSUE: Direct eval allows PHP code execution e.g. calc=phpinfo() or system('ls')
eval("\\$result = " . $formula . ";");
echo "Result: " . $result;

// File avatar upload handler
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['avatar'])) {
    $target_dir = "uploads/";
    // SECURITY ISSUE: Using client-supplied filename without extension whitelist validation
    $target_file = $target_dir . basename($_FILES["avatar"]["name"]);
    
    if (move_uploaded_file($_FILES["avatar"]["tmp_name"], $target_file)) {
        echo "The file ". htmlspecialchars(basename($_FILES["avatar"]["name"])). " has been uploaded.";
    }
}
?>
`
  }
];
