const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// OAuth credentials from environment variables
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const USER = process.env.GMAIL_USER;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

// Email details from environment variables
const fromEmail = process.env.FROM_EMAIL || USER;   // Default to USER if FROM_EMAIL is not provided
const toEmail = process.env.TO_EMAIL || USER;       // Default to USER if TO_EMAIL is not provided
const subject = process.env.SUBJECT;                // Email subject
const text = process.env.TEXT;                      // Email text

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendEmail() {
    try {
        // Fetch access token dynamically using refresh token
        const accessToken = await oauth2Client.getAccessToken();

        // Configure Nodemailer with OAuth2
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: USER,
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });

        const mailOptions = {
            from: fromEmail,
            to: toEmail,
            subject: subject,
            text: text,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent:', result);
    } catch (error) {
        console.log('Error sending email:', error);
    }
}

sendEmail();
