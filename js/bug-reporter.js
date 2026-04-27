// js/bug-reporter.js

(function() {
  const BUG_REPORT_EMAIL = 'nazimcpunity@gmail.com';
  
  // Ignore specific errors (like network/fetch issues)
  const isNetworkError = (msg) => {
    if (!msg) return false;
    const lowerMsg = msg.toString().toLowerCase();
    return lowerMsg.includes('fetch') || 
           lowerMsg.includes('networkerror') || 
           lowerMsg.includes('failed to fetch') ||
           lowerMsg.includes('net::err');
  };

  let modalInjected = false;
  let currentErrorContext = null;

  function injectModal() {
    if (modalInjected) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'bug-report-overlay hidden';
    overlay.id = 'bug-report-overlay';
    
    overlay.innerHTML = `
      <div class="bug-report-modal">
        <h3>🐛 Oops! Something went wrong</h3>
        <p>We encountered an unexpected error. Would you like to send a bug report to help us fix it?</p>
        <div class="bug-report-details" id="bug-report-details"></div>
        <div class="bug-report-actions">
          <button class="btn-secondary" id="bug-report-cancel">Dismiss</button>
          <button class="btn-danger" id="bug-report-send">Report Bug</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('bug-report-cancel').addEventListener('click', () => {
      document.getElementById('bug-report-overlay').classList.add('hidden');
    });
    
    document.getElementById('bug-report-send').addEventListener('click', async () => {
      const sendBtn = document.getElementById('bug-report-send');
      sendBtn.innerText = 'Sending...';
      sendBtn.disabled = true;
      
      try {
        await sendBugReportEmail(currentErrorContext.message, currentErrorContext.stack);
        sendBtn.innerText = 'Report Sent!';
        setTimeout(() => {
          document.getElementById('bug-report-overlay').classList.add('hidden');
        }, 2000);
      } catch (err) {
        console.error('Failed to send bug report:', err);
        sendBtn.innerText = 'Failed to Send';
        setTimeout(() => {
          sendBtn.innerText = 'Report Bug';
          sendBtn.disabled = false;
        }, 2000);
      }
    });
    
    modalInjected = true;
  }

  function showBugReportModal(msg, stack) {
    if (isNetworkError(msg)) return;
    
    // Create the modal if it doesn't exist
    if (!modalInjected) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectModal);
      } else {
        injectModal();
      }
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const overlay = document.getElementById('bug-report-overlay');
      const details = document.getElementById('bug-report-details');
      
      if (overlay && details) {
        currentErrorContext = { message: msg, stack: stack };
        details.innerText = `${msg}\n\n${stack || 'No stack trace available'}`;
        overlay.classList.remove('hidden');
        // Reset button
        const sendBtn = document.getElementById('bug-report-send');
        if (sendBtn) {
          sendBtn.innerText = 'Report Bug';
          sendBtn.disabled = false;
        }
      }
    }, 100);
  }

  async function sendBugReportEmail(errorMsg, errorStack) {
    // Dynamically load emailjs SDK if not available
    if (!window.emailjs) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load EmailJS'));
        document.head.appendChild(script);
      });
    }

    // Try to load our email config if not present
    if (!window.sendEmailJSEmail && typeof EMAILJS_PUBLIC_KEY === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const isPages = window.location.pathname.includes('/pages/');
        script.src = isPages ? '../js/email.js' : 'js/email.js';
        script.onload = () => resolve();
        script.onerror = () => resolve(); // Ignore errors, fallback below
        document.head.appendChild(script);
      });
    }

    // Use constants from email.js or fallback to known good ones
    const publicKey = (typeof EMAILJS_PUBLIC_KEY !== 'undefined') ? EMAILJS_PUBLIC_KEY : 'XW2yXrnm6ywU9Z6Tp';
    const serviceId = (typeof EMAILJS_SERVICE_ID !== 'undefined') ? EMAILJS_SERVICE_ID : 'service_wgbbk9v';
    const templateId = (typeof EMAILJS_TEMPLATE_ID !== 'undefined') ? EMAILJS_TEMPLATE_ID : 'template_k9642ep';

    // Init EmailJS
    emailjs.init({ publicKey });

    // Use existing template, injecting bug details into the article fields
    const templateParams = {
      to_email: BUG_REPORT_EMAIL,
      site_name: 'Noor Al-Quran (Bug Reporter)',
      article_title: 'BUG REPORT: ' + errorMsg,
      article_excerpt: 'Error details:\n' + errorStack,
      article_category: 'System Error',
      article_author: 'Automated Reporter',
      article_url: window.location.href,
      article_image: 'https://images.unsplash.com/photo-1525785967371-87ba44b3e6cf?w=600&auto=format', // A bug/tech image
      unsub_url: '#',
      site_url: window.location.origin
    };

    const result = await emailjs.send(serviceId, templateId, templateParams);
    if (result.status !== 200) {
      throw new Error('EmailJS failed: ' + result.text);
    }
    return result;
  }

  // Global Error Handlers
  window.addEventListener('error', function(e) {
    // Ignore cross-origin script errors
    if (e.message === 'Script error.') return;
    
    const msg = e.message;
    const stack = e.error ? e.error.stack : (e.filename + ':' + e.lineno);
    showBugReportModal(msg, stack);
  });

  window.addEventListener('unhandledrejection', function(e) {
    const reason = e.reason;
    const msg = reason ? (reason.message || reason) : 'Unhandled Promise Rejection';
    const stack = reason && reason.stack ? reason.stack : '';
    showBugReportModal(msg, stack);
  });

  // Expose globally to be called manually by feature catch blocks
  window.showBugReportModal = showBugReportModal;

})();
