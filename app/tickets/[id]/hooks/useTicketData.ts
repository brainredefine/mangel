// app/tickets/[id]/hooks/useTicketData.ts

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { getBuildingInfoAction } from '../actions';
import type {
  Profile,
  TicketWithMeta,
  AttachmentWithUrl,
  BuildingInfo,
  Attachment,
} from '../types';

export type TicketDataState = {
  // Auth & Profile
  profile: Profile | null;
  currentUserId: string | null;
  isAdminAm: boolean;

  // Ticket Data
  ticket: TicketWithMeta | null;
  attachments: AttachmentWithUrl[];

  // Building Info (Odoo)
  buildingInfo: BuildingInfo | null;
  loadingBuildingInfo: boolean;

  // Loading State
  loading: boolean;
  errorMsg: string | null;

  // Setters for updates
  setTicket: React.Dispatch<React.SetStateAction<TicketWithMeta | null>>;
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentWithUrl[]>>;
};

export function useTicketData(ticketId: string): TicketDataState {
  const router = useRouter();

  // Auth & Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Ticket Data
  const [ticket, setTicket] = useState<TicketWithMeta | null>(null);
  const [attachments, setAttachments] = useState<AttachmentWithUrl[]>([]);

  // Building Info
  const [buildingInfo, setBuildingInfo] = useState<BuildingInfo | null>(null);
  const [loadingBuildingInfo, setLoadingBuildingInfo] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdminAm = profile?.role === 'admin_am';

  useEffect(() => {
    const load = async () => {
      if (!ticketId) return;

      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Auth
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/auth');
          return;
        }

        setCurrentUserId(user.id);

        // 2. Profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profileData) {
          console.error(profileError);
          setErrorMsg('Ihr Profil kann nicht geladen werden.');
          setLoading(false);
          return;
        }

        setProfile(profileData as Profile);
        const isCurrentUserAdmin = profileData.role === 'admin_am';

        // 3. Ticket
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', ticketId)
          .single();

        if (ticketError || !ticketData) {
          console.error(ticketError);
          setErrorMsg('Ticket nicht gefunden.');
          setLoading(false);
          return;
        }

        const t = ticketData as TicketWithMeta;

        // 4. Security Check
        if (!isCurrentUserAdmin) {
          const ticketTenantId = t.tenant_id ? String(t.tenant_id) : null;
          const userTenantId = profileData.tenant_id ? String(profileData.tenant_id) : null;

          const isSameTenant = ticketTenantId && userTenantId && ticketTenantId === userTenantId;
          const isCreator = t.created_by === user.id;

          if (!isSameTenant && !isCreator) {
            setErrorMsg('Sie haben keinen Zugriff auf dieses Ticket.');
            setLoading(false);
            return;
          }
        }

        setTicket(t);

        // 5. Attachments
        const { data: attachmentsData, error: attachmentsError } = await supabase
          .from('ticket_attachments')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (attachmentsError) {
          console.error(attachmentsError);
        } else {
          // Filter private for non-admin
          const safeAttachments = (attachmentsData || []).filter((att: any) => {
            if (att.privacy === 'private' && !isCurrentUserAdmin) return false;
            return true;
          });

          // Bucket ist privat → signierte URLs (1h gültig), nicht getPublicUrl.
          const withUrls: AttachmentWithUrl[] = await Promise.all(
            safeAttachments.map(async (att: Attachment) => {
              const { data } = await supabase.storage
                .from('ticket_attachments')
                .createSignedUrl(att.file_path, 60 * 60);
              return { ...att, url: data?.signedUrl ?? null };
            })
          );

          setAttachments(withUrls);
        }

        setLoading(false);

        // 6. Building Info (async)
        if (t.odoo_tenancy_id) {
          setLoadingBuildingInfo(true);
          try {
            const res = await getBuildingInfoAction(t.odoo_tenancy_id);
            if (res.success) setBuildingInfo(res.data as BuildingInfo);
            else console.warn('Building info error:', res.error);
          } catch (err) {
            console.error('Error fetching Odoo info', err);
          }
          setLoadingBuildingInfo(false);
        }
      } catch (err) {
        console.error('useTicketData error:', err);
        setErrorMsg('Ein unerwarteter Fehler ist aufgetreten.');
        setLoading(false);
      }
    };

    load();
  }, [router, ticketId]);

  return {
    profile,
    currentUserId,
    isAdminAm,
    ticket,
    attachments,
    buildingInfo,
    loadingBuildingInfo,
    loading,
    errorMsg,
    setTicket,
    setAttachments,
  };
}
