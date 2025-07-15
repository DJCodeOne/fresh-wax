// src/index.js
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST") {
      try {
        const formData = await request.json();
        
        if (url.pathname === "/newsletter" || formData.type === "newsletter") {
          return await handleNewsletterSignup(formData, env);
        }
        
        return await handleContactForm(formData, env);
      } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({
          error: "Failed to process request"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    if (request.method === "GET") {
      // 🔥 NEW: Admin API endpoint
      if (url.pathname === "/admin/stats") {
        return await handleAdminStats(env);
      }

      if (url.pathname === "/admin/subscribers") {
  return await handleAdminSubscribers(env, request);
}
      return new Response("Fresh Wax Email Handler - Ready for contact forms and newsletter signups", {
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};

// 🔥 NEW: Admin Stats API
async function handleAdminStats(env) {
  try {
    console.log('DEBUG: Admin stats requested');

    // Get total subscribers
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM subscribers').first();
    
    // Get today's subscribers
    const todayResult = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM subscribers WHERE DATE(subscribed_at) = DATE('now')"
    ).first();
    
    // Get this week's subscribers
    const weekResult = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM subscribers WHERE DATE(subscribed_at) >= DATE('now', '-7 days')"
    ).first();

    // Get this month's subscribers
    const monthResult = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM subscribers WHERE DATE(subscribed_at) >= DATE('now', '-30 days')"
    ).first();

    const stats = {
      total: totalResult.count,
      today: todayResult.count,
      thisWeek: weekResult.count,
      thisMonth: monthResult.count,
      lastUpdated: new Date().toISOString()
    };

    console.log('DEBUG: Admin stats:', stats);

    return new Response(JSON.stringify(stats), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return new Response(JSON.stringify({
      error: "Failed to fetch admin stats"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

// 🔥 NEW: Admin Subscribers API
async function handleAdminSubscribers(env, request) {
  try {
    console.log('DEBUG: Admin subscribers requested');

    // Get all subscribers
const result = await env.DB.prepare(
  'SELECT id, email, name, subscribed_at, status FROM subscribers ORDER BY subscribed_at DESC LIMIT 50'
).all();

    const subscribers = {
      subscribers: result.results,
      count: result.results.length,
    };

    console.log('DEBUG: Admin subscribers:', subscribers.count, 'records');

    return new Response(JSON.stringify(subscribers), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error("Error fetching admin subscribers:", error);
    return new Response(JSON.stringify({
      error: "Failed to fetch subscribers"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

async function handleNewsletterSignup(formData, env) {
  console.log('DEBUG: Newsletter signup started for:', formData.email);
  console.log('DEBUG: Environment DB available:', !!env.DB);

  if (!formData.email) {
    return new Response(JSON.stringify({
      error: "Email address is required"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    return new Response(JSON.stringify({
      error: "Please enter a valid email address"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    // Save subscriber to database first
    console.log('DEBUG: About to save to database...');
    
    const dbResult = await env.DB.prepare(
      'INSERT INTO subscribers (email, name) VALUES (?, ?)'
    ).bind(formData.email, formData.name || null).run();

    console.log('DEBUG: Database result:', dbResult);
    console.log('DEBUG: Database success:', dbResult.success);

    if (!dbResult.success) {
      console.error('DEBUG: Database save failed:', dbResult.error);
      // Handle duplicate email or other database errors
      if (dbResult.error && dbResult.error.includes('UNIQUE constraint failed')) {
        return new Response(JSON.stringify({
          error: "This email is already subscribed to our newsletter."
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      
      throw new Error(`Database error: ${dbResult.error}`);
    }

    console.log('DEBUG: Subscriber saved successfully, ID:', dbResult.meta.last_row_id);

    // Send welcome email to subscriber
    const welcomeEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "noreply@freshwax.co.uk",
        to: formData.email,
        subject: "🎵 Welcome to Fresh Wax!",
        html: `
          <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to Fresh Wax</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #ffffff;
      line-height: 1.6;
      padding: 20px 0;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #111111 0%, #1f1f1f 100%);
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #ff6b35 100%);
      padding: 30px 20px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      position: relative;
      z-index: 1;
      margin-bottom: 5px;
    }

    .tagline {
      font-size: 14px;
      color: #ffffff;
      opacity: 0.9;
      position: relative;
      z-index: 1;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .content {
      padding: 40px 30px;
    }

    .greeting {
      font-size: 24px;
      color: #ff6b35;
      margin-bottom: 20px;
      font-weight: bold;
    }

    .intro {
      font-size: 16px;
      color: #cccccc;
      margin-bottom: 30px;
    }

    .features {
      background: rgba(255, 107, 53, 0.15); /* stronger bg */
      border-radius: 10px;
      padding: 25px;
      margin: 30px 0;
      border-left: 4px solid #ff6b35;
      color: #fff; /* white text for better contrast */
    }

    .features h3 {
      color: #ff6b35;
      margin-bottom: 20px;
      font-size: 20px;
      text-align: center;
    }

    .features p {
      font-weight: 600;
      margin-bottom: 10px;
      font-size: 16px;
    }

    .footer {
      background: #0a0a0a;
      padding: 25px;
      text-align: center;
      border-top: 2px solid #ff6b35;
    }

    .footer-logo {
      font-size: 20px;
      font-weight: bold;
      color: #ff6b35;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎵 FRESH WAX</div>
      <div class="tagline">Vinyl • Digital • Underground</div>
    </div>

    <div class="content">
      <div class="greeting">Welcome to the Family!</div>

      <div class="intro">
        A new online store supplying all the latest releases on vinyl and digital from the labels that matter! You're now part of the Fresh Wax collective where the beats never stop and the basslines hit different.
      </div>

      <div class="features">
        <h3>What's Coming Your Way</h3>
        <p>🔥 First access to new arrivals and exclusive drops</p>
        <p>💿 Limited edition vinyl releases</p>
        <p>🎧 Underground events and live streaming</p>
        <p>📦 Archive Crates with rare gems</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-logo">FRESH WAX</div>
      <p>freshwax.co.uk</p>
    </div>
  </div>
</body>
</html>

        `
      })
    });

    // Send notification email to you
    const notificationEmail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "noreply@freshwax.co.uk",
        to: "david@freshwax.co.uk",
        subject: "🎵 New Subscriber - Fresh Wax",
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>New Subscriber</h2>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Name:</strong> ${formData.name || "Not provided"}</p>
            <p><strong>Signed up:</strong> ${new Date().toLocaleString("en-GB")}</p>
            <p><strong>Source:</strong> Website newsletter signup</p>
            <p><strong>Database ID:</strong> ${dbResult.meta.last_row_id}</p>
          </div>
        `
      })
    });

    if (welcomeEmail.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: "Successfully subscribed! Check your email for a welcome message."
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else {
      const errorData = await welcomeEmail.text();
      console.error("Resend API error:", errorData);
      throw new Error("Failed to send welcome email");
    }

  } catch (error) {
    console.error("Error in newsletter signup:", error);
    return new Response(JSON.stringify({
      error: "Failed to process newsletter signup"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

async function handleContactForm(formData, env) {
  if (!formData.name || !formData.email || !formData.message) {
    return new Response(JSON.stringify({
      error: "Missing required fields: name, email, message"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "contact@freshwax.co.uk",
        to: "david@freshwax.co.uk",
        subject: "New Contact Form Submission - Fresh Wax",
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${formData.name}</p>
          <p><strong>Email:</strong> ${formData.email}</p>
          <p><strong>Message:</strong></p>
          <p>${formData.message.replace(/\n/g, "<br>")}</p>
          <hr>
          <p><small>Sent from Fresh Wax contact form</small></p>
        `
      })
    });

    if (emailResponse.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: "Message sent successfully"
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error("Failed to send email");
    }

  } catch (error) {
    console.error("Error processing contact form:", error);
    return new Response(JSON.stringify({
      error: "Failed to process form submission"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}