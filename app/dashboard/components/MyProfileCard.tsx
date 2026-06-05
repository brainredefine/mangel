// /app/dashboard/components/MyProfileCard.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPartnerProfileAction } from '../actions';

type PartnerProfile = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  vat: string | null;
};

type Props = {
  partnerId: number | null;
};

export function MyProfileCard({ partnerId }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) {
      console.log('❌ [MyProfileCard] No partnerId');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      console.log('🔄 [MyProfileCard] Fetching profile for:', partnerId);
      const res = await getPartnerProfileAction(partnerId);
      console.log('📦 [MyProfileCard] Response:', JSON.stringify(res));
      if (res.success && res.data) {
        console.log('✅ [MyProfileCard] Setting profile:', res.data.name);
        setProfile(res.data);
      } else {
        console.log('⚠️ [MyProfileCard] No data or error');
      }
      setLoading(false);
    };

    load();
  }, [partnerId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-black/5 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-black/5 rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-black/5 rounded w-2/3"></div>
            <div className="h-4 bg-black/5 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-black/5 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <svg className="w-4 h-4 text-[#A86E3A]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <h2 className="text-xs font-bold text-black uppercase tracking-wider">
          Meine Kontaktdaten
        </h2>
      </div>

      {/* Info Grid */}
      <div className="space-y-3">
        {/* Name */}
        <InfoRow label="Name" value={profile.name} />
        
        {/* Email */}
        {profile.email && (
          <InfoRow label="E-Mail" value={profile.email} />
        )}
        
        {/* Phone */}
        {(profile.phone || profile.mobile) && (
          <InfoRow label="Telefon" value={profile.phone || profile.mobile || ''} />
        )}
        
        {/* Address */}
        {profile.address && (
          <InfoRow label="Adresse" value={profile.address} multiline />
        )}
        
        {/* VAT */}
        {profile.vat && (
          <InfoRow label="USt-ID" value={profile.vat} />
        )}
      </div>

      {/* Message */}
      <div className="mt-6 pt-5 border-t border-black/5">
        <p className="text-xs text-black/50 leading-relaxed">
          Stimmt etwas nicht oder haben sich Ihre Daten geändert?{' '}
          <button
            onClick={() => router.push('/tickets/new/request')}
            className="text-[#A86E3A] font-bold hover:underline"
          >
            Bitte teilen Sie uns dies per Anfrage mit.
          </button>
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs text-black/40">{label}</p>
      <p className={`text-sm text-black ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</p>
    </div>
  );
}