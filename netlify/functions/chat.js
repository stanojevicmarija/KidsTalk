const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, body: JSON.stringify({ content: [{ type: 'text', text: 'Error: API key not found' }] }) };
  }

  try {
    const { messages, system } = JSON.parse(event.body);

    var geminiContents = [{ role: 'user', parts: [{ text: system + '\n\nNow start the conversation.' }] }, { role: 'model', parts: [{ text: 'Understood! I will follow these instructions.' }] }];
    
    for (var i = 0; i < messages.length; i++) {
      geminiContents.push({
        role: messages[i].role === 'assistant' ? 'model' : 'user',
        parts: [{ text: messages[i].content }]
      });
    }

    var postData = JSON.stringify({
      contents: geminiContents,
      generationConfig: { maxOutputTokens: 1000 }
    });

    var path = '/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

    var result = await new Promise(function(resolve, reject) {
      var req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, function(res) {
        var data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try { resolve(JSON.parse(data)); }
          catch(e) { resolve({ error: { message: data.substring(0, 200), code: 'parse_error' } }); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    if (result.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: [{ type: 'text', text: 'API Error: ' + result.error.message + ' (code: ' + result.error.code + ')' }] })
      };
    }

    var aiText = 'No response';
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      aiText = result.candidates[0].content.parts.map(function(p) { return p.text; }).join('');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text: aiText }] })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text: 'Error: ' + error.message }] })
    };
  }
};
