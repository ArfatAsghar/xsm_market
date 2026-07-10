
import React from 'react';
import { Shield, Users, Zap, Award, TrendingUp, Lock } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-xsm-black to-xsm-dark-gray py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-xsm-yellow mb-6">
            About XSM Market
          </h1>
          <p className="text-xl md:text-2xl text-white max-w-4xl mx-auto leading-relaxed">
            The world's most trusted marketplace for buying and selling YouTube channels. 
            We connect content creators with investors through secure, website agent-protected transactions.
          </p>
        </div>

        {/* Mission Statement */}
        <div className="xsm-card mb-16 text-center">
          <h2 className="text-3xl font-bold text-xsm-yellow mb-6">Our Mission</h2>
          <p className="text-lg text-white leading-relaxed max-w-4xl mx-auto">
            To revolutionize the digital asset marketplace by providing a secure, transparent, and efficient platform 
            for YouTube channel trading. We believe in empowering creators to monetize their hard work while helping 
            investors discover profitable opportunities in the creator economy.
          </p>
        </div>

        {/* Key Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-xsm-yellow mb-12 text-center">Why Choose XSM Market?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="xsm-card text-center">
              <Shield className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Secure Website Agent</h3>
              <p className="text-xsm-light-gray">
                Every transaction is protected by our website agent service. Funds are held securely until 
                the channel transfer is complete and verified.
              </p>
            </div>
            <div className="xsm-card text-center">
              <Users className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Verified Sellers</h3>
              <p className="text-xsm-light-gray">
                All sellers go through our verification process. We validate channel ownership 
                and performance metrics before listings go live.
              </p>
            </div>
            <div className="xsm-card text-center">
              <Zap className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Instant Transfers</h3>
              <p className="text-xsm-light-gray">
                Our streamlined process ensures quick channel transfers. Most transactions 
                are completed within 24-48 hours.
              </p>
            </div>
            <div className="xsm-card text-center">
              <Award className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Premium Support</h3>
              <p className="text-xsm-light-gray">
                Our expert team provides 24/7 support throughout the entire transaction process, 
                ensuring smooth deals for both parties.
              </p>
            </div>
            <div className="xsm-card text-center">
              <TrendingUp className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Market Analytics</h3>
              <p className="text-xsm-light-gray">
                Access comprehensive analytics and market insights to make informed decisions 
                about channel valuations and investments.
              </p>
            </div>
            <div className="xsm-card text-center">
              <Lock className="w-16 h-16 text-xsm-yellow mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-3">Privacy Protection</h3>
              <p className="text-xsm-light-gray">
                Your personal information and transaction details are protected with 
                enterprise-grade security and encryption.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-xsm-yellow mb-12 text-center">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* For Sellers */}
            <div className="xsm-card">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">For Sellers</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">List Your Channel</h4>
                    <p className="text-xsm-light-gray text-sm">Submit your channel details and analytics for review</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Verification Process</h4>
                    <p className="text-xsm-light-gray text-sm">Our team verifies your channel ownership and metrics</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Go Live</h4>
                    <p className="text-xsm-light-gray text-sm">Your channel appears on our marketplace for buyers</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Secure Sale</h4>
                    <p className="text-xsm-light-gray text-sm">Complete the sale through our website agent system</p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Buyers */}
            <div className="xsm-card">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">For Buyers</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Browse Channels</h4>
                    <p className="text-xsm-light-gray text-sm">Explore verified channels using our advanced filters</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Due Diligence</h4>
                    <p className="text-xsm-light-gray text-sm">Review analytics, contact sellers, and ask questions</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Initiate Purchase</h4>
                    <p className="text-xsm-light-gray text-sm">Pay the service fee to start the secure transaction process</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-xsm-yellow text-xsm-black rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Receive Channel</h4>
                    <p className="text-xsm-light-gray text-sm">Get full ownership once the transfer is verified</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-xsm-yellow mb-12 text-center">Our Impact</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-xsm-yellow mb-2">$2.5M+</div>
              <div className="text-white font-medium">Total Transactions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-xsm-yellow mb-2">500+</div>
              <div className="text-white font-medium">Channels Sold</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-xsm-yellow mb-2">1,200+</div>
              <div className="text-white font-medium">Happy Users</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-xsm-yellow mb-2">99.8%</div>
              <div className="text-white font-medium">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="xsm-card text-center">
          <h2 className="text-3xl font-bold text-xsm-yellow mb-8">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Transparency</h3>
              <p className="text-xsm-light-gray">
                We believe in clear communication and honest dealings. All fees, processes, and policies are transparent.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Security</h3>
              <p className="text-xsm-light-gray">
                Your safety is our priority. We use industry-leading security measures to protect your transactions.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Innovation</h3>
              <p className="text-xsm-light-gray">
                We continuously improve our platform with cutting-edge technology and user feedback.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
