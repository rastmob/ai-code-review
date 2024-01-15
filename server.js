
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');



const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname)));

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/review-file', async (req, res) => {
    const fileUrl = req.query.repo_url;
    const accessToken = req.query.access_token; // For private repos

    console.log(fileUrl);

    if (!fileUrl) {
        return res.status(400).send('File URL is required');
    }

    try {
        const fileResponse = await axios.get(fileUrl, {
            headers: { Authorization: `token ${accessToken}` },
        });
        let fileContent;

        if (fileResponse.data.encoding === 'base64') {
            const encodedContent = fileResponse.data.content;
            fileContent = Buffer.from(encodedContent, 'base64').toString('utf-8');
        } else {
            fileContent = fileResponse.data.content;
        }
        console.log(fileContent);
        const openaiResponse = await openai.createCompletion({
            model: "code-davinci-002", // Choose the appropriate model
            prompt: "Review this code:\n" + fileContent, // Construct your prompt
            max_tokens: 150,
        });
     
        res.json({ review: openaiResponse.data.choices[0].text });
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/check-repo', async (req, res) => {
    const fileUrl = req.query.repo_url; // Assuming the file URL is passed as a query parameter

    console.log(fileUrl);
    try {
        await axios.get(fileUrl); 
        res.redirect(`/review-file?repo_url=${encodeURIComponent(fileUrl)}`);
    } catch (error) {
        console.log(error);
       
        res.redirect('/auth/github?repo_url=' + encodeURIComponent(fileUrl));
    }
});


app.get('/auth/github', (req, res) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}`;
    res.redirect(url);
});


app.get('/auth/github/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Code not provided');
    }

    try {

        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: code,
            },
            {
                headers: {
                    accept: 'application/json',
                },
            }
        );

        const accessToken = tokenResponse.data.access_token;

        res.redirect(`/repo?access_token=${accessToken}`);
    } catch (error) {
        console.error('Error exchanging code for token:', error.response?.data || error.message);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/repo', async (req, res) => {
    const repoUrl = req.query.repo_url;
    try {
        const repoData = await axios.get(repoUrl, {
            headers: { Authorization: `token ${accessToken}` },
        });
        res.json(repoData.data);
    } catch (error) {
        res.status(500).json({ message: 'Error accessing repository' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
