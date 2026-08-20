import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, DollarSign, CreditCard, Eye, FileText, Calendar, CheckCircle, Clock } from 'lucide-react';

interface DealCardData {
  deal_id: number;
  transaction_id: string;
  channel_title: string;
  channel_price: number;
  escrow_fee: number;
  deal_status: string;
  buyer_username: string;
  seller_id: string;
  transaction_type: string;
  payment_methods: Array<{ id: string; name: string; category: string }>;
  created_at: string;
}

interface DealCardMessageProps {
  dealData: DealCardData;
  isHighlighted?: boolean;
  messageRef?: React.RefObject<HTMLDivElement>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  seller_reviewing: {
    label: 'Awaiting Seller',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  seller_agreed: {
    label: 'Seller Agreed',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  fee_pending: {
    label: 'Fee Pending',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    icon: <DollarSign className="w-3 h-3" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: <Shield className="w-3 h-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    icon: <Shield className="w-3 h-3" />,
  },
};

const DealCardMessage: React.FC<DealCardMessageProps> = ({ dealData, isHighlighted = false, messageRef }) => {
  const navigate = useNavigate();

  const statusInfo = STATUS_CONFIG[dealData.deal_status] || {
    label: dealData.deal_status?.replace(/_/g, ' ') || 'Pending',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10 border-gray-500/30',
    icon: <Clock className="w-3 h-3" />,
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      ref={messageRef}
      className={`w-full flex justify-center my-3 px-2 transition-all duration-500 ${
        isHighlighted ? 'scale-[1.02]' : ''
      }`}
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl border shadow-xl overflow-hidden transition-all duration-500 ${
          isHighlighted
            ? 'border-xsm-yellow shadow-[0_0_24px_rgba(255,208,0,0.35)] ring-2 ring-xsm-yellow/50'
            : 'border-xsm-yellow/30'
        } bg-gradient-to-br from-[#1a1600] via-xsm-dark-gray to-[#121212]`}
      >
        {/* Yellow top accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-xsm-yellow via-amber-400 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-xsm-medium-gray/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-xsm-yellow/20 rounded-lg border border-xsm-yellow/30">
              <Shield className="w-3.5 h-3.5 text-xsm-yellow" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-xsm-yellow">Deal Started</p>
              <p className="text-[10px] text-gray-400 font-mono">TXN{String(dealData.deal_id || 0).padStart(4, '0')}</p>
            </div>
          </div>
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>

        {/* Channel info */}
        <div className="px-4 py-3">
          <p className="text-white font-bold text-sm truncate mb-2.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-xsm-yellow flex-shrink-0" />
            {dealData.channel_title}
          </p>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="bg-xsm-black/60 rounded-lg p-2 border border-xsm-medium-gray/20">
              <p className="text-[10px] text-gray-400 mb-0.5">Sale Price</p>
              <p className="text-base font-black text-xsm-yellow">${Number(dealData.channel_price || 0).toLocaleString()}</p>
            </div>
            <div className="bg-xsm-black/60 rounded-lg p-2 border border-xsm-medium-gray/20">
              <p className="text-[10px] text-gray-400 mb-0.5">Escrow Fee</p>
              <p className="text-base font-black text-white">${Number(dealData.escrow_fee || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Payment methods */}
          {dealData.payment_methods && dealData.payment_methods.length > 0 && (
            <div className="mb-2.5">
              <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Payment Methods
              </p>
              <div className="flex flex-wrap gap-1">
                {dealData.payment_methods.map((m, i) => (
                  <span key={i} className="text-[10px] bg-xsm-yellow/10 border border-xsm-yellow/20 text-xsm-yellow px-1.5 py-0.5 rounded-md font-medium">
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-3">
            <Calendar className="w-3 h-3" />
            <span>Created {formatDate(dealData.created_at)}</span>
          </div>

          {/* Review Deal Button */}
          <button
            type="button"
            onClick={() => navigate('/seller-deals')}
            className="w-full flex items-center justify-center gap-2 bg-xsm-yellow text-black font-bold text-xs py-2 rounded-xl hover:bg-yellow-400 transition-all duration-200 shadow-md shadow-xsm-yellow/20 hover:shadow-xsm-yellow/40 active:scale-95"
          >
            <Eye className="w-3.5 h-3.5" />
            Review Deal
          </button>
        </div>
      </div>
    </div>
  );
};

export default DealCardMessage;
