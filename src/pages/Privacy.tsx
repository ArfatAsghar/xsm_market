import React from 'react';
import {
  Shield,
  Database,
  Lock,
  Users,
  Mail,
  Eye,
  FileText,
  MessageCircle,
  AlertTriangle,
  Globe,
  RefreshCcw
} from 'lucide-react';

const Privacy: React.FC = () => {
  const sections = [
    {
      icon: <Database className="w-6 h-6 text-xsm-yellow" />,
      title: '1. Information We Collect',
      content: [
        'When you use XSM Market, we may collect information that you provide directly, including your name, username, email address, password or authentication method, profile details, listing details, uploaded screenshots, messages, support requests, and account settings.',
        'When sellers create listings, we may collect listing information such as platform type, category, title, description, price, subscriber or follower count, monetization status, screenshots, channel links, and other information needed to display the listing properly.',
        'We may also collect technical information such as IP address, browser type, device information, operating system, pages visited, date and time of access, usage activity, and basic security logs.'
      ]
    },
    {
      icon: <Eye className="w-6 h-6 text-xsm-yellow" />,
      title: '2. How We Use Information',
      content: [
        'We use information to create and manage accounts, authenticate users, display listings, allow buyers and sellers to communicate, support marketplace activity, improve user experience, prevent fraud, detect misuse, and maintain platform security.',
        'We may also use information to respond to support requests, investigate disputes, enforce marketplace rules, monitor suspicious activity, and improve the reliability and performance of XSM Market.'
      ]
    },
    {
      icon: <FileText className="w-6 h-6 text-xsm-yellow" />,
      title: '3. Public Listings and Uploaded Content',
      content: [
        'Information added to a public listing may be visible to other users. This can include the listing title, description, price, category, screenshots, seller profile information, and other marketplace details.',
        'Sellers are responsible for making sure that screenshots do not contain private passwords, recovery codes, personal addresses, payment information, private messages, or any other sensitive information.'
      ]
    },
    {
      icon: <MessageCircle className="w-6 h-6 text-xsm-yellow" />,
      title: '4. Chat and Marketplace Messages',
      content: [
        'XSM Market may store messages exchanged between buyers, sellers, and support representatives so that users can continue conversations, review deal discussions, and receive help when needed.',
        'Messages may also be reviewed where necessary to investigate fraud, resolve disputes, enforce rules, improve user safety, or respond to legal or security concerns.'
      ]
    },
    {
      icon: <Users className="w-6 h-6 text-xsm-yellow" />,
      title: '5. Sharing of Information',
      content: [
        'We do not sell your personal information. We may share limited information only when needed to operate the marketplace, provide services, protect users, comply with legal obligations, prevent fraud, or support dispute handling.',
        'Certain information is naturally visible to other users, such as seller names, public profile details, listings, chat participants, and transaction-related marketplace activity.'
      ]
    },
    {
      icon: <Globe className="w-6 h-6 text-xsm-yellow" />,
      title: '6. Cookies and Similar Technologies',
      content: [
        'XSM Market may use cookies, local storage, and similar technologies to keep users signed in, remember preferences, improve platform performance, protect accounts, and understand how the website is used.',
        'Users may disable cookies through their browser settings, but some parts of the platform may not work correctly if cookies or local storage are disabled.'
      ]
    },
    {
      icon: <Lock className="w-6 h-6 text-xsm-yellow" />,
      title: '7. Security of Your Information',
      content: [
        'We use reasonable technical and organizational measures to protect user accounts, listings, messages, and marketplace data from unauthorized access, misuse, alteration, or loss.',
        'However, no online platform can guarantee complete security. Users are responsible for keeping passwords secure, using trusted devices, and notifying XSM Market if they suspect unauthorized access.'
      ]
    },
    {
      icon: <Shield className="w-6 h-6 text-xsm-yellow" />,
      title: '8. User Rights and Choices',
      content: [
        'Users may update account details, manage listings, change account settings, request email changes, and contact support for account-related help.',
        'Depending on applicable law, users may request access, correction, deletion, or restriction of certain personal information. Some information may be retained where required for security, legal, fraud-prevention, or dispute-resolution purposes.'
      ]
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-xsm-yellow" />,
      title: '9. Children and Age Restrictions',
      content: [
        'XSM Market is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we become aware that a user under 18 has provided personal information, we may remove the account and related data.'
      ]
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-xsm-yellow" />,
      title: '10. Updates to This Policy',
      content: [
        'We may update this Privacy Policy from time to time to reflect changes in platform features, legal requirements, security practices, or marketplace operations.',
        'Updated versions will be posted on this page. Continued use of XSM Market after updates means you accept the revised policy.'
      ]
    },
    {
      icon: <Mail className="w-6 h-6 text-xsm-yellow" />,
      title: '11. Contact Us',
      content: [
        'If you have questions about this Privacy Policy, your account information, or privacy-related requests, please contact XSM Market through the official Contact page or available support channels.'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-xsm-black text-white">
      <div className="bg-gradient-to-b from-xsm-dark-gray to-xsm-black border-b border-xsm-medium-gray">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-xsm-yellow/15 border border-xsm-yellow/40 rounded-xl p-3">
              <Shield className="w-8 h-8 text-xsm-yellow" />
            </div>
            <div>
              <p className="text-xsm-yellow font-semibold tracking-wide uppercase text-sm">
                XSM Market
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Privacy Policy
              </h1>
            </div>
          </div>

          <p className="text-gray-100 text-lg leading-8 max-w-4xl">
            This Privacy Policy explains how XSM Market collects, uses, stores, shares, and protects information when users access the platform, create accounts, publish listings, upload screenshots, communicate through chat, or use marketplace services.
          </p>

          <p className="text-gray-300 mt-5 font-medium">
            Last updated: July 2026
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <section className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Overview
          </h2>
          <p className="text-gray-100 leading-8">
            XSM Market is a social media marketplace that allows users to list, browse, discuss, and manage potential purchases or sales of digital assets such as social media accounts, channels, pages, and related marketplace listings. We process information only as needed to operate the platform, support users, protect the marketplace, and improve the service.
          </p>
        </section>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-start gap-4">
                <div className="bg-black/30 border border-xsm-medium-gray rounded-xl p-3 flex-shrink-0">
                  {section.icon}
                </div>

                <div className="w-full">
                  <h2 className="text-2xl font-bold text-white mb-4">
                    {section.title}
                  </h2>

                  <div className="space-y-4">
                    {section.content.map((paragraph) => (
                      <p key={paragraph} className="text-gray-100 leading-8">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 bg-xsm-yellow/10 border border-xsm-yellow/50 rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-xsm-yellow mb-4">
            Important Safety Notice
          </h2>
          <p className="text-gray-100 leading-8">
            Do not share passwords, recovery codes, private emails, phone numbers, payment credentials, personal documents, or sensitive information inside listings, screenshots, or public descriptions. Users should keep communication and deal-related activity inside XSM Market whenever possible for better safety and support.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Privacy;