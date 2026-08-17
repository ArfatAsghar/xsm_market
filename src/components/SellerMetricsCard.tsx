import React from 'react';
import { ShieldCheck, CheckCircle2, DollarSign, Users, Zap, TrendingUp } from 'lucide-react';
import { SellerMetrics } from '@/services/auth';

interface SellerMetricsCardProps {
  metrics?: SellerMetrics;
  className?: string;
}

export const SellerMetricsCard: React.FC<SellerMetricsCardProps> = ({ metrics, className = '' }) => {
  const reputationScore = metrics?.reputationScore ?? 0;
  const thisMonthPoints = metrics?.thisMonthPoints ?? 0;
  const completedDeals = metrics?.completedDeals ?? 0;
  const positiveReviews = metrics?.positiveReviews ?? 0;
  const noReviews = metrics?.noReviews ?? 0;
  const negativeReviews = metrics?.negativeReviews ?? 0;
  const tradingVolume = metrics?.tradingVolume ?? 0;
  const returningPartners = metrics?.returningPartners ?? 0;
  const responseTime = metrics?.responseTime || 'Under 15 min';

  return (
    <div className={`w-full text-left bg-xsm-black/80 border border-xsm-medium-gray/40 rounded-xl p-4 space-y-3.5 shadow-lg ${className}`}>
      {/* 1. Reputation Score */}
      <div className="relative group pb-2.5 border-b border-xsm-medium-gray/30 flex items-center justify-between cursor-help">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="font-semibold text-white text-xs sm:text-sm">Reputation Score</span>
        </div>
        <div className="text-right">
          <div className="font-bold text-xsm-yellow text-sm">
            {reputationScore.toLocaleString()}
          </div>
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 px-2 py-0.5 rounded-full border ${
            thisMonthPoints >= 0
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
          }`}>
            <TrendingUp className="w-3 h-3" />
            {thisMonthPoints >= 0 ? `+${thisMonthPoints.toLocaleString()}` : thisMonthPoints.toLocaleString()}{' '}
            this month
          </div>
        </div>
        {/* Tooltip */}
        <div className="absolute left-1/2 -top-16 -translate-x-1/2 hidden group-hover:block z-30 w-64 bg-gray-900/95 text-gray-200 text-[11px] p-2.5 rounded-lg border border-gray-700 shadow-2xl pointer-events-none text-center leading-relaxed">
          Reputation Score is calculated from completed transactions, reviews, and returning partners. Positive activity increases score; negative reviews reduce it.
        </div>
      </div>

      {/* 2. Completed Deals */}
      <div className="relative group pb-2.5 border-b border-xsm-medium-gray/30 cursor-help">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="font-semibold text-white text-xs sm:text-sm">Completed Deals</span>
          </div>
          <span className="font-bold text-white text-sm">
            {completedDeals.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pl-9">
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {positiveReviews} Positive
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            {noReviews} No Review
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {negativeReviews} Negative
          </span>
        </div>
        {/* Tooltip */}
        <div className="absolute left-1/2 -top-14 -translate-x-1/2 hidden group-hover:block z-30 w-64 bg-gray-900/95 text-gray-200 text-[11px] p-2.5 rounded-lg border border-gray-700 shadow-2xl pointer-events-none text-center leading-relaxed">
          Shows total successfully completed transactions and how those transactions were rated.
        </div>
      </div>

      {/* 3. Trading Volume */}
      <div className="relative group pb-2.5 border-b border-xsm-medium-gray/30 flex items-center justify-between cursor-help">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="font-semibold text-white text-xs sm:text-sm">Trading Volume</span>
        </div>
        <span className="font-bold text-white text-sm">
          ${tradingVolume.toLocaleString()}
        </span>
        {/* Tooltip */}
        <div className="absolute left-1/2 -top-14 -translate-x-1/2 hidden group-hover:block z-30 w-64 bg-gray-900/95 text-gray-200 text-[11px] p-2.5 rounded-lg border border-gray-700 shadow-2xl pointer-events-none text-center leading-relaxed">
          Total value of successfully completed transactions made through the marketplace.
        </div>
      </div>

      {/* 4. Returning Partners */}
      <div className="relative group pb-2.5 border-b border-xsm-medium-gray/30 flex items-center justify-between cursor-help">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
            <Users className="w-4 h-4" />
          </div>
          <span className="font-semibold text-white text-xs sm:text-sm">Returning Partners</span>
        </div>
        <span className="font-bold text-white text-sm">
          {returningPartners.toLocaleString()}
        </span>
        {/* Tooltip */}
        <div className="absolute left-1/2 -top-14 -translate-x-1/2 hidden group-hover:block z-30 w-64 bg-gray-900/95 text-gray-200 text-[11px] p-2.5 rounded-lg border border-gray-700 shadow-2xl pointer-events-none text-center leading-relaxed">
          Number of users who completed a transaction with this user and returned to complete another transaction with them.
        </div>
      </div>

      {/* 5. Response Time */}
      <div className="relative group flex items-center justify-between cursor-help">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow">
            <Zap className="w-4 h-4" />
          </div>
          <span className="font-semibold text-white text-xs sm:text-sm">Response Time</span>
        </div>
        <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-full bg-xsm-yellow/10 border border-xsm-yellow/30 text-xsm-yellow">
          <Zap className="w-3 h-3 fill-xsm-yellow/20" />
          {responseTime}
        </span>
        {/* Tooltip */}
        <div className="absolute left-1/2 -top-14 -translate-x-1/2 hidden group-hover:block z-30 w-64 bg-gray-900/95 text-gray-200 text-[11px] p-2.5 rounded-lg border border-gray-700 shadow-2xl pointer-events-none text-center leading-relaxed">
          Shows how quickly this user typically responds to new messages based on recent conversation history.
        </div>
      </div>
    </div>
  );
};

export default SellerMetricsCard;
