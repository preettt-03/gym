import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import type { MemberDetail } from "@/lib/member-api";
import { fmtDate, memberCode } from "@/lib/member-ui";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export function MemberCardDialog({ member, open, onClose }: { member: MemberDetail; open: boolean; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    // The QR carries the full member id so a desk scanner can open this page.
    QRCode.toDataURL(`KF-MEMBER:${member.id}`, { margin: 1, width: 240, color: { dark: "#0a0a0a", light: "#ffffff" } }).then(setQr, () => setQr(null));
  }, [open, member.id]);

  const m = member.membership;
  const initials = (member.name ?? member.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Member card"
      description="Prints at credit-card size (85.6 × 54 mm). Choose “Actual size” in the print dialog."
      footer={
        <>
          <Button variant="glass" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()} disabled={!qr}>
            <Printer className="h-4 w-4" /> Print card
          </Button>
        </>
      }
    >
      <div className="flex justify-center py-2">
        <div
          className="print-card relative flex overflow-hidden rounded-[10px] border border-gold/40 text-[#f5f5f5] shadow-2xl"
          style={{ width: "85.6mm", height: "54mm", background: "linear-gradient(135deg,#141414 0%,#0a0a0a 60%,#1c1708 100%)", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        >
          <div className="absolute inset-x-0 top-0 h-[1.2mm] bg-gradient-to-r from-[#ac9a5f] via-[#f3db86] to-[#ac9a5f]" />
          <div className="flex flex-1 flex-col justify-between p-[3.5mm]">
            <div className="flex items-center gap-[2mm]">
              <img src={logo} alt="" className="h-[8mm] w-[8mm]" />
              <div className="leading-none">
                <p className="text-[3.4mm] font-bold tracking-wide text-[#e2c46e]">KING&apos;S FITNESS</p>
                <p className="mt-[0.6mm] text-[1.8mm] tracking-[0.3em] text-white/60">MEMBER</p>
              </div>
            </div>
            <div className="flex items-center gap-[2.5mm]">
              {member.photoUrl ? (
                <img src={member.photoUrl} alt="" className="h-[13mm] w-[13mm] rounded-[2mm] border border-[#e2c46e]/50 object-cover" />
              ) : (
                <span className="flex h-[13mm] w-[13mm] items-center justify-center rounded-[2mm] border border-[#e2c46e]/50 bg-[#e2c46e]/15 text-[4mm] font-bold text-[#e2c46e]">{initials}</span>
              )}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[3.6mm] font-bold uppercase">{member.name ?? member.email}</p>
                <p className="mt-[0.8mm] font-mono text-[2.4mm] tracking-wider text-[#e2c46e]">{memberCode(member.id)}</p>
                <p className="mt-[0.8mm] text-[2.1mm] text-white/70">
                  {m ? `${m.plan.name} · valid till ${fmtDate.format(new Date(m.endDate))}` : "No active plan"}
                </p>
                {member.phone && <p className="text-[2.1mm] text-white/60">{member.phone}</p>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-[1mm] bg-white/[0.03] px-[3mm]">
            {qr ? <img src={qr} alt={`QR code for ${memberCode(member.id)}`} className="h-[24mm] w-[24mm] rounded-[1.5mm]" /> : <span className="h-[24mm] w-[24mm] animate-pulse rounded-[1.5mm] bg-white/10" />}
            <p className="text-[1.7mm] tracking-[0.2em] text-white/50">SCAN AT DESK</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
