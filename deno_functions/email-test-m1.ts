// Setup type definitions for built-in Supabase Runtime APIs
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import nodemailer from 'npm:nodemailer';
console.log(`Function "send-email" up and running!`);
serve(async (req)=>{
  // Define CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };
  // Handle CORS preflight request (OPTIONS method)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      message: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const { to, subject, html, attachment } = await req.json();
    // Access secrets from environment variables
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    if (!gmailUser || !gmailAppPassword) {
      console.error('Email credentials missing in environment variables.');
      return new Response(JSON.stringify({
        message: 'Server configuration error: Email credentials missing.'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      },
      tls: {
        rejectUnauthorized: false // This can be set to true in production if you have proper certs, but false often works for Google SMTP.
      }
    });
    const mailOptions = {
      from: `TUM.ai Admin <${gmailUser}>`,
      to: 'membership-certificate@tum-ai.com',
      subject: subject,
      html: html,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content,
          encoding: attachment.encoding
        }
      ]
    };
    await transporter.sendMail(mailOptions);
    return new Response(JSON.stringify({
      message: 'Email sent successfully!'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(JSON.stringify({
      message: 'Error sending email.',
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
