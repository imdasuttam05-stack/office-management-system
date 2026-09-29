import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hrApi } from "../lib/hrApi.js";

const emptyForm = { name: "", startTime: "09:00", endTime: "17:30", breakMinutes: "30", graceMinutes: "0", overtimeAfterMinutes: "0" };

export default function ShiftManagement() {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const data = await hrApi.shifts(); setShifts(data.shifts || []); }
    catch (e) { setError(e.message || "Failed to load shifts"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function editShift(row) {
    setEditingId(row._id);
    setForm({
      name: row.name || "",
      startTime: row.startTime || "09:00",
      endTime: row.endTime || "17:30",
      breakMinutes: String(row.breakMinutes ?? 30),
      graceMinutes: String(row.graceMinutes ?? 0),
      overtimeAfterMinutes: String(row.overtimeAfterMinutes ?? 0),
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() { setEditingId(""); setForm(emptyForm); setMessage(""); setError(""); }

  async function save(e) {
    e.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      const body = {
        ...form,
        breakMinutes: Number(form.breakMinutes || 0),
        graceMinutes: Number(form.graceMinutes || 0),
        overtimeAfterMinutes: Number(form.overtimeAfterMinutes || 0),
      };
      if (!body.name.trim()) throw new Error("Shift name is required.");
      if (editingId) await hrApi.updateShift(editingId, body);
      else await hrApi.createShift(body);
      setMessage(editingId ? "Shift updated successfully." : "Shift created successfully.");
      reset();
      await load();
    } catch (e) { setError(e.message || "Unable to save shift"); }
    finally { setSaving(false); }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.kicker}>HR MANAGEMENT</div>
          <h1 style={S.title}>Shift Management</h1>
          <p style={S.sub}>Create and manage staff working shifts.</p>
        </div>
        <button style={S.secondary} onClick={() => navigate("/attendance")}>← Attendance</button>
      </div>

      {(message || error) && <div style={error ? S.error : S.success}>{error || message}</div>}

      <section style={S.card}>
        <div style={S.cardHead}><h2 style={S.h2}>{editingId ? "Edit Shift" : "Add Shift"}</h2>{editingId && <button style={S.secondary} onClick={reset}>Cancel Edit</button>}</div>
        <form onSubmit={save} style={S.form}>
          <label style={S.label}>Shift Name<input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="General Shift" /></label>
          <label style={S.label}>Start Time<input style={S.input} type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} /></label>
          <label style={S.label}>End Time<input style={S.input} type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} /></label>
          <label style={S.label}>Break Minutes<input style={S.input} type="number" min="0" value={form.breakMinutes} onChange={e=>setForm({...form,breakMinutes:e.target.value})} /></label>
          <label style={S.label}>Grace Minutes<input style={S.input} type="number" min="0" value={form.graceMinutes} onChange={e=>setForm({...form,graceMinutes:e.target.value})} /></label>
          <label style={S.label}>OT After Minutes<input style={S.input} type="number" min="0" value={form.overtimeAfterMinutes} onChange={e=>setForm({...form,overtimeAfterMinutes:e.target.value})} /></label>
          <div style={S.actions}><button style={S.primary} disabled={saving}>{saving ? "Saving..." : editingId ? "Update Shift" : "Save Shift"}</button></div>
        </form>
      </section>

      <section style={S.card}>
        <div style={S.cardHead}><h2 style={S.h2}>Available Shifts</h2><button style={S.secondary} onClick={load}>Refresh</button></div>
        {loading ? <div style={S.empty}>Loading shifts...</div> : shifts.length === 0 ? <div style={S.empty}>No shifts created yet.</div> : <div style={S.tableWrap}><table style={S.table}><thead><tr><th style={S.th}>Shift</th><th style={S.th}>Office Time</th><th style={S.th}>Break</th><th style={S.th}>Grace</th><th style={S.th}>OT After</th><th style={S.th}>Action</th></tr></thead><tbody>{shifts.map(row=><tr key={row._id}><td style={S.td}><b>{row.name}</b></td><td style={S.td}>{row.startTime} - {row.endTime}</td><td style={S.td}>{row.breakMinutes || 0} min</td><td style={S.td}>{row.graceMinutes || 0} min</td><td style={S.td}>{row.overtimeAfterMinutes || 0} min</td><td style={S.td}><button style={S.edit} onClick={()=>editShift(row)}>Edit</button></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

const S = {
  page:{minHeight:"100vh",background:"#f5f7fb",padding:"28px",fontFamily:"Arial,Helvetica,sans-serif",color:"#172b4d"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20,marginBottom:20},
  kicker:{fontSize:12,fontWeight:800,color:"#667085",letterSpacing:1},
  title:{margin:"5px 0 4px",fontSize:28},
  sub:{margin:0,color:"#667085"},
  card:{background:"#fff",border:"1px solid #e4e7ec",borderRadius:14,padding:20,marginBottom:20,boxShadow:"0 4px 16px rgba(16,24,40,.05)"},
  cardHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16},
  h2:{margin:0,fontSize:19},
  form:{display:"grid",gridTemplateColumns:"repeat(3,minmax(180px,1fr))",gap:14},
  label:{display:"flex",flexDirection:"column",gap:7,fontSize:13,fontWeight:700},
  input:{width:"100%",padding:"11px 12px",border:"1px solid #d0d5dd",borderRadius:9,fontSize:14,background:"#fff",boxSizing:"border-box"},
  actions:{display:"flex",alignItems:"end"},
  primary:{border:0,borderRadius:9,padding:"11px 18px",background:"#173b68",color:"#fff",fontWeight:700,cursor:"pointer"},
  secondary:{border:"1px solid #d0d5dd",borderRadius:9,padding:"10px 14px",background:"#fff",color:"#173b68",fontWeight:700,cursor:"pointer"},
  edit:{border:"1px solid #d0d5dd",borderRadius:8,padding:"7px 12px",background:"#fff",cursor:"pointer",fontWeight:700},
  success:{background:"#ecfdf3",border:"1px solid #abefc6",color:"#067647",padding:12,borderRadius:9,marginBottom:16},
  error:{background:"#fef3f2",border:"1px solid #fecdca",color:"#b42318",padding:12,borderRadius:9,marginBottom:16},
  tableWrap:{overflowX:"auto"}, table:{width:"100%",borderCollapse:"collapse"}, th:{textAlign:"left",padding:"12px 10px",borderBottom:"2px solid #eaecf0",fontSize:12,color:"#667085"}, td:{padding:"13px 10px",borderBottom:"1px solid #eaecf0",fontSize:14}, empty:{padding:30,textAlign:"center",color:"#667085"}
};
