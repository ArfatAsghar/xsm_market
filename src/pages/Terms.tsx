import React from 'react';
import {
  FileText,
  Users,
  ShoppingCart,
  ShieldCheck,
  AlertTriangle,
  Scale,
  MessageCircle,
  Ban,
  Lock,
  RefreshCcw,
  CreditCard
} from 'lucide-react';

const Terms: React.FC = () => {
  const sections = [
    {
      icon: <FileText className="w-6 h-6 text-xsm-yellow" />,
      title: '1. Acceptance of Terms',
      content: [
        'By accessing or using XSM Market, you agree to these Terms of Service, our Privacy Policy, marketplace rules, safety requirements, and any additional policies displayed on the platform.',
        'If you do not agree with these Terms, you should not access or use XSM Market.'
      ]
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-xsm-yellow" />,
      title: '2. About XSM Market',
      content: [
        'XSM Market is an independent marketplace platform that allows users to list, browse, and communicate about social media accounts, pages, channels, and other approved digital assets.',
        'XSM Market provides listing tools, profile pages, chat features, and marketplace support features. Unless clearly stated otherwise, XSM Market is not the owner, seller, buyer, broker, auctioneer, financial institution, or payment processor for user listings.'
      ]
    },
    {
      icon: <Users className="w-6 h-6 text-xsm-yellow" />,
      title: '3. User Accounts',
      content: [
        'Users must provide accurate, complete, and current account information. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.',
        'You must not impersonate another person, create misleading accounts, create accounts to bypass restrictions, or use another user’s account without permission.',
        'XSM Market may suspend, restrict, or remove accounts that violate these Terms, create risk for other users, or interfere with platform safety.'
      ]
    },
    {
      icon: <ShoppingCart className="w-6 h-6 text-xsm-yellow" />,
      title: '4. Digital Assets and Listings',
      content: [
        'For these Terms, digital assets may include social media accounts, channels, pages, groups, or similar online assets that are permitted to be listed on XSM Market.',
        'Sellers must only list digital assets that they own, control, or are fully authorized to transfer. Listing information must be accurate, complete, and not misleading.',
        'Listing descriptions may include relevant details such as niche, audience, growth, monetization, traffic, income information, account age, and platform-specific details. Sellers must not include private passwords, recovery information, or prohibited contact/payment instructions in public listings.'
      ]
    },
    {
      icon: <Ban className="w-6 h-6 text-xsm-yellow" />,
      title: '5. Prohibited Listings and Content',
      content: [
        'Users must not list stolen, hacked, compromised, unauthorized, illegal, misleading, or fraudulent digital assets.',
        'Listings involving illegal content, explicit material, hate speech, violence, threats, extremist content, scams, malware, gambling content where not legally permitted, or content that violates applicable laws or third-party platform rules may be removed.',
        'The sale of artificial engagement or manipulation services is prohibited. This includes fake likes, fake followers, fake subscribers, fake comments, fake views, bots, scripts, or any activity designed to manipulate platform metrics.'
      ]
    },
    {
      icon: <MessageCircle className="w-6 h-6 text-xsm-yellow" />,
      title: '6. Communication and Chat Rules',
      content: [
        'The chat system is provided so buyers, sellers, and support representatives can communicate about listings and marketplace activity.',
        'Users must not use chat to harass, threaten, spam, deceive, share harmful content, request prohibited transactions, bypass marketplace safety features, or pressure others into unsafe off-platform activity.',
        'XSM Market may review messages where necessary to investigate suspicious activity, enforce rules, resolve disputes, or protect users.'
      ]
    },
    {
      icon: <CreditCard className="w-6 h-6 text-xsm-yellow" />,
      title: '7. Transactions, Payments, and Escrow Support',
      content: [
        'XSM Market may provide transaction support, escrow-style workflow, or deal facilitation tools where available. These tools are designed to support safer communication and transaction coordination between buyers and sellers.',
        'Unless clearly stated in writing, XSM Market is not a bank, regulated escrow agent, trustee, payment service provider, or financial institution. Users are responsible for understanding the risks of any transaction before proceeding.',
        'Buyers and sellers are responsible for verifying listing details, transfer requirements, platform rules, payment arrangements, and the legal permissibility of any transaction.'
      ]
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-xsm-yellow" />,
      title: '8. Buyer and Seller Responsibilities',
      content: [
        'Buyers should carefully review listing details, seller profile information, screenshots, pricing, and deal terms before proceeding.',
        'Sellers must cooperate honestly during discussions, provide accurate information, and complete transfers only where they are authorized and able to do so.',
        'Both buyers and sellers should keep important deal communication inside XSM Market so that support can better assist if a problem occurs.'
      ]
    },
    {
      icon: <AlertTriangle className="w-6 h-6 text-xsm-yellow" />,
      title: '9. Disputes and Platform Review',
      content: [
        'XSM Market may assist with dispute review where marketplace tools, chat history, listing records, or support information are available.',
        'We may remove listings, restrict accounts, pause marketplace activity, or take other action if we believe a user has violated these Terms, created risk, provided misleading information, or engaged in suspicious activity.',
        'XSM Market cannot guarantee the outcome of every transaction, the accuracy of every listing, or the behavior of every buyer or seller.'
      ]
    },
    {
      icon: <Lock className="w-6 h-6 text-xsm-yellow" />,
      title: '10. Security and Account Protection',
      content: [
        'Users are responsible for protecting their login credentials, email access, recovery information, and devices.',
        'You must notify XSM Market if you suspect unauthorized account access, suspicious messages, fraudulent listings, or misuse of the platform.'
      ]
    },
    {
      icon: <Scale className="w-6 h-6 text-xsm-yellow" />,
      title: '11. Disclaimers and Limitation of Liability',
      content: [
        'XSM Market is provided on an “as is” and “as available” basis. We try to keep the platform secure and reliable, but we do not guarantee uninterrupted access, error-free operation, or the accuracy of all user-generated content.',
        'To the maximum extent permitted by law, XSM Market is not responsible for indirect losses, lost profits, lost business opportunities, loss of data, damage to reputation, or losses resulting from user conduct, third-party platforms, or transactions between users.'
      ]
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-xsm-yellow" />,
      title: '12. Changes to These Terms',
      content: [
        'We may update these Terms from time to time to improve platform safety, reflect new features, or comply with legal and operational requirements.',
        'Updated Terms will be posted on this page. Continued use of XSM Market after changes are posted means you accept the updated Terms.'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-xsm-black text-white">
      <div className="bg-gradient-to-b from-xsm-dark-gray to-xsm-black border-b border-xsm-medium-gray">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-xsm-yellow/15 border border-xsm-yellow/40 rounded-xl p-3">
              <FileText className="w-8 h-8 text-xsm-yellow" />
            </div>
            <div>
              <p className="text-xsm-yellow font-semibold tracking-wide uppercase text-sm">
                XSM Market
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Terms of Service
              </h1>
            </div>
          </div>

          <p className="text-gray-100 text-lg leading-8 max-w-4xl">
            These Terms of Service explain the rules for using XSM Market, creating listings, communicating with users, and participating in marketplace activity.
          </p>

          <p className="text-gray-300 mt-5 font-medium">
            Last updated: July 2026
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <section className="bg-xsm-dark-gray border border-xsm-medium-gray rounded-2xl p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Platform Role
          </h2>
          <p className="text-gray-100 leading-8 mb-4">
            XSM Market provides marketplace technology that helps users publish listings, discover digital assets, communicate with other users, and manage marketplace discussions. XSM Market does not automatically guarantee ownership, transferability, income claims, subscriber counts, platform compliance, or the final outcome of any deal.
          </p>
          <p className="text-gray-100 leading-8">
            Users are responsible for performing their own due diligence and ensuring that their activity complies with applicable laws, third-party platform policies, and these Terms.
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
            Marketplace Safety Notice
          </h2>
          <p className="text-gray-100 leading-8">
            Users should avoid off-platform payments, avoid sharing account credentials in listings or public messages, and report suspicious activity. XSM Market may remove content, limit accounts, or restrict platform access where needed to protect users and maintain marketplace integrity.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Terms;