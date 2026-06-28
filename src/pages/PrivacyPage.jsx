import { Link } from 'react-router-dom'

const EFFECTIVE = 'June 28, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">← Back to login</Link>
          <h1 className="text-3xl font-bold text-white mt-6 mb-1">Privacy Policy</h1>
          <p className="text-slate-500 text-sm">Effective {EFFECTIVE} · PolyHQ LLC</p>
        </div>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. Introduction</h2>
            <p>PolyHQ LLC ("PolyHQ," "we," "us," or "our") respects your privacy. This Privacy Policy explains what information we collect when you use PolyHQ (the "Service"), how we use it, and the choices you have. By using the Service, you agree to the practices described here.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. Information We Collect</h2>
            <h3 className="text-sm font-medium text-slate-200 mb-2">Information you provide directly</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 mb-4">
              <li>Account information: name, email address, and password when you register</li>
              <li>Business data: employee names, contact details, hourly rates, and job information you enter into the Service</li>
              <li>Payroll and financial data: time entries, expenses, revenue records, and invoice details</li>
              <li>Communications: messages you send to our support team</li>
            </ul>
            <h3 className="text-sm font-medium text-slate-200 mb-2">Information collected automatically</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Usage data: pages visited, features used, and timestamps of activity</li>
              <li>Device and browser information: browser type, operating system, and screen resolution</li>
              <li>Log data: IP address, referring URLs, and error reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>Provide, maintain, and improve the Service</li>
              <li>Authenticate your identity and protect your account</li>
              <li>Process and display payroll, scheduling, and financial data you enter</li>
              <li>Send important notices, such as security alerts or changes to our Terms</li>
              <li>Respond to support requests and troubleshoot issues</li>
              <li>Analyze usage patterns to improve product features (in aggregate, anonymized form)</li>
              <li>Comply with applicable law and enforce our Terms of Service</li>
            </ul>
            <p className="mt-3">We do <strong className="text-white">not</strong> sell or rent your personal information to third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. Data Storage</h2>
            <p>The current version of PolyHQ stores business data locally in your browser using <strong className="text-white">localStorage</strong>. This means your business data resides on your device and is not transmitted to our servers unless you explicitly share it. You are responsible for maintaining backups of locally stored data. We do not have access to data stored solely in your browser's localStorage.</p>
            <p className="mt-3">Account registration data (name, email, encrypted password) may be stored on our servers to enable multi-device access where that feature is available.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. Sharing of Information</h2>
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li><strong className="text-slate-300">Service providers</strong> who assist in operating the Service (e.g., hosting, analytics), bound by confidentiality obligations</li>
              <li><strong className="text-slate-300">Legal authorities</strong> when required by law, court order, or to protect the rights, property, or safety of PolyHQ LLC, our users, or the public</li>
              <li><strong className="text-slate-300">Business transfers</strong> in connection with a merger, acquisition, or sale of assets, with notice to you</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. Cookies and Tracking</h2>
            <p>We may use cookies and similar technologies to maintain your session, remember preferences, and analyze usage. You can configure your browser to refuse cookies, but doing so may limit functionality. We do not currently use third-party advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. Data Retention</h2>
            <p>We retain account information for as long as your account is active or as needed to provide the Service. If you close your account, we will delete or anonymize your personal information within 90 days, except where retention is required by law or for legitimate business purposes such as dispute resolution.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">8. Security</h2>
            <p>We implement industry-standard technical and organizational measures to protect your information from unauthorized access, disclosure, alteration, and destruction. However, no method of transmission or storage is 100% secure. You are responsible for keeping your account credentials confidential.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">9. Your Rights and Choices</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-400">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate personal information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to or restrict certain processing of your information</li>
              <li>Data portability — receive your data in a structured, machine-readable format</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at <a href="mailto:support@polyhqapp.com" className="text-indigo-400 hover:text-indigo-300">support@polyhqapp.com</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">10. Children's Privacy</h2>
            <p>The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">11. Third-Party Links</h2>
            <p>The Service may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies before providing any information to them.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes by posting the updated policy with a new effective date. Continued use of the Service after changes constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">13. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact:</p>
            <address className="not-italic mt-2 text-slate-400">
              PolyHQ LLC — Privacy Team<br />
              <a href="mailto:support@polyhqapp.com" className="text-indigo-400 hover:text-indigo-300">support@polyhqapp.com</a>
            </address>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-600">
          <span>© 2026 PolyHQ LLC. All rights reserved.</span>
          <Link to="/terms" className="text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}
