begin;

-- Uploads and downloads used to travel through the Vercel function body, which
-- caps a single invocation's request and response payloads at 4.5 MB. The real
-- sponsoring templates reach 4.39 MB, so the 20 MB these buckets advertise was
-- effectively unreachable and every artifact download was capped too.
--
-- Browsers now PUT straight to the artifact's final location with a signed URL
-- and read it back through a short-lived signed URL, exactly as reimbursement
-- receipts have done since 20260622160000. The buckets stay private and every
-- URL is minted server-side; an outbound fetch made by a function is not
-- subject to the payload cap, so the server still downloads and validates the
-- object before any row references it.
--
-- Storage therefore holds the real file types rather than opaque encrypted
-- octet streams: a signed URL has to serve bytes the browser can open.
update "storage"."buckets"
set "allowed_mime_types" = array[
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where "id" = 'contract-template-documents';

update "storage"."buckets"
set "allowed_mime_types" = array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
where "id" = 'contract-render-artifacts';

-- No storage.objects policies are added. Uploads need a server-minted signed
-- token and downloads a server-minted signed URL, so access stays mediated.

do $$
begin
    if exists (
        select 1 from "storage"."buckets"
        where "id" in (
            'contract-template-documents',
            'contract-render-artifacts'
        )
        and "public" is true
    ) then
        raise exception 'contract storage buckets must stay private';
    end if;
end $$;

commit;
