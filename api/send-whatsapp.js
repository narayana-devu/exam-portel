// Vercel Serverless Function for WhatsApp Notifications
// Uses Gupshup API to send WhatsApp messages

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phone, message } = req.body;

    // Validate inputs
    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message required' });
    }

    // Get API credentials from environment variables
    const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
    const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME;

    if (!GUPSHUP_API_KEY || !GUPSHUP_APP_NAME) {
        console.error('Missing Gupshup credentials');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Call Gupshup WhatsApp API
        const response = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
            method: 'POST',
            headers: {
                'apikey': GUPSHUP_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                channel: 'whatsapp',
                source: GUPSHUP_APP_NAME,
                destination: phone,
                'src.name': GUPSHUP_APP_NAME,
                message: JSON.stringify({
                    type: 'text',
                    text: message
                })
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ WhatsApp sent successfully:', data);
            return res.status(200).json({ success: true, data });
        } else {
            console.error('❌ Gupshup API error:', data);
            return res.status(response.status).json({ error: 'Failed to send WhatsApp', details: data });
        }
    } catch (error) {
        console.error('❌ WhatsApp send error:', error);
        return res.status(500).json({ error: error.message });
    }
}
