import React, { useMemo, useState } from "react";

const staffData = [
  {
    id: 1,
    name: "ABHISEK DAS",
    code: "HANS017",
    status: "P",
    inTime: "9:41 AM",
    outTime: "NA",
    hours: "NA",
    note: "",
  },
  {
    id: 2,
    name: "Bishnu Sarkar",
    code: "HANS009",
    status: "P",
    inTime: "11:24 AM",
    outTime: "NA",
    hours: "NA",
    note: "",
  },
  {
    id: 3,
    name: "Bishwajit Kumar Shaw",
    code: "HANS015",
    status: "P",
    inTime: "10:01 AM",
    outTime: "NA",
    hours: "NA",
    note: "",
  },
  {
    id: 4,
    name: "Rahul Das",
    code: "HANS021",
    status: "A",
    inTime: "",
    outTime: "",
    hours: "0h 0m",
    note: "",
  },
  {
    id: 5,
    name: "Suman Roy",
    code: "HANS024",
    status: "HD",
    inTime: "9:30 AM",
    outTime: "1:30 PM",
    hours: "4h 0m",
    note: "",
  },
];

const statusInfo = {
  P: {
    label: "Present",
    className: "present",
  },
  A: {
    label: "Absent",
    className: "absent",
  },
  HD: {
    label: "Half Day",
    className: "halfday",
  },
  L: {
    label: "Leave",
    className: "leave",
  },
};

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState("2026-09-18");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All Locations");
  const [statusFilter, setStatusFilter] = useState("All");
  const [notes, setNotes] = useState({});
  const [showNoteFor, setShowNoteFor] = useState(null);

  const summary = useMemo(() => {
    return {
      totalStaff: 42,
      present: 1,
      absent: 6,
      halfDay: 0,
      overtime: "0h 16m",
      fine: "0h 0m",
      leave: 0,
      punchedIn: 23,
      punchedOut: 1,
      pending: 4,
    };
  }, []);

  const filteredStaff = staffData.filter((staff) => {
    const searchMatch =
      staff.name.toLowerCase().includes(search.toLowerCase()) ||
      staff.code.toLowerCase().includes(search.toLowerCase());

    const statusMatch =
      statusFilter === "All" ||
      (statusFilter === "Present" && staff.status === "P") ||
      (statusFilter === "Absent" && staff.status === "A") ||
      (statusFilter === "Half Day" && staff.status === "HD") ||
      (statusFilter === "Leave" && staff.status === "L");

    return searchMatch && statusMatch;
  });

  const saveNote = (id) => {
    setShowNoteFor(null);
  };

  return (
    <div className="attendance-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .attendance-page {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 24px;
          font-family: Arial, Helvetica, sans-serif;
          color: #172033;
        }

        .attendance-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }

        .page-title {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
        }

        .page-subtitle {
          margin-top: 5px;
          color: #697386;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .date-box,
        .select-box,
        .search-box {
          height: 42px;
          border: 1px solid #d8dee9;
          background: #fff;
          border-radius: 8px;
          padding: 0 12px;
          outline: none;
        }

        .date-box:focus,
        .select-box:focus,
        .search-box:focus {
          border-color: #2563eb;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e3e7ef;
          border-radius: 12px;
          padding: 18px;
          min-height: 105px;
        }

        .summary-label {
          color: #697386;
          font-size: 13px;
          margin-bottom: 9px;
        }

        .summary-value {
          font-size: 27px;
          font-weight: 700;
        }

        .summary-small {
          font-size: 13px;
          color: #7a8496;
          margin-top: 5px;
        }

        .pending-box {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .pending-title {
          font-weight: 700;
          color: #9a3412;
        }

        .pending-text {
          font-size: 14px;
          color: #7c2d12;
        }

        .primary-btn,
        .secondary-btn,
        .danger-btn {
          border: none;
          border-radius: 8px;
          padding: 10px 15px;
          cursor: pointer;
          font-weight: 600;
        }

        .primary-btn {
          background: #2563eb;
          color: white;
        }

        .secondary-btn {
          background: white;
          border: 1px solid #d8dee9;
          color: #344054;
        }

        .danger-btn {
          background: #dc2626;
          color: white;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 22px;
        }

        .action-card {
          background: #fff;
          border: 1px solid #e3e7ef;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
          cursor: pointer;
          font-weight: 600;
          color: #344054;
          transition: 0.15s;
        }

        .action-card:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .action-icon {
          font-size: 21px;
          margin-bottom: 7px;
        }

        .attendance-panel {
          background: #fff;
          border: 1px solid #e3e7ef;
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-header {
          padding: 18px;
          border-bottom: 1px solid #e7ebf1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .panel-title {
          font-size: 19px;
          font-weight: 700;
        }

        .panel-controls {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .search-box {
          width: 230px;
        }

        .staff-list {
          width: 100%;
        }

        .staff-row {
          padding: 18px;
          border-bottom: 1px solid #edf0f4;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .staff-row:last-child {
          border-bottom: none;
        }

        .staff-info {
          min-width: 230px;
        }

        .staff-name {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .staff-code {
          font-size: 12px;
          color: #7a8496;
        }

        .attendance-details {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
        }

        .hours {
          font-size: 13px;
          color: #697386;
          min-width: 55px;
        }

        .time-info {
          font-size: 13px;
          color: #475467;
        }

        .status {
          min-width: 105px;
          padding: 7px 10px;
          border-radius: 7px;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
        }

        .status.present {
          background: #dcfce7;
          color: #166534;
        }

        .status.absent {
          background: #fee2e2;
          color: #991b1b;
        }

        .status.halfday {
          background: #fef3c7;
          color: #92400e;
        }

        .status.leave {
          background: #e0e7ff;
          color: #3730a3;
        }

        .note-area {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 190px;
        }

        .note-input {
          width: 170px;
          height: 36px;
          border: 1px solid #d8dee9;
          border-radius: 7px;
          padding: 0 9px;
        }

        .legend {
          padding: 15px 18px;
          background: #fafbfc;
          border-top: 1px solid #e7ebf1;
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #667085;
        }

        .legend-item strong {
          color: #344054;
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .quick-actions {
            grid-template-columns: repeat(3, 1fr);
          }

          .staff-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .attendance-details {
            width: 100%;
            flex-wrap: wrap;
          }
        }

        @media (max-width: 650px) {
          .attendance-page {
            padding: 12px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .quick-actions {
            grid-template-columns: repeat(2, 1fr);
          }

          .search-box {
            width: 100%;
          }

          .panel-controls {
            width: 100%;
          }
        }
      `}</style>

      <div className="attendance-container">

        <div className="top-header">
          <div>
            <h1 className="page-title">Attendance Summary</h1>
            <div className="page-subtitle">
              Daily staff attendance management
            </div>
          </div>

          <div className="header-actions">
            <select
              className="select-box"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option>All Locations</option>
              <option>Kolkata Office</option>
              <option>Howrah Office</option>
              <option>Warehouse</option>
            </select>

            <input
              className="date-box"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <button className="secondary-btn">
              ⚙ Settings
            </button>
          </div>
        </div>

        <div className="pending-box">
          <div>
            <div className="pending-title">
              Total Pending for Approval : {summary.pending}
            </div>
            <div className="pending-text">
              Attendance records waiting for review
            </div>
          </div>

          <button className="primary-btn">
            Review
          </button>
        </div>

        <div className="summary-grid">

          <SummaryCard
            title="Total Staff"
            value={summary.totalStaff}
          />

          <SummaryCard
            title="Present"
            value={summary.present}
          />

          <SummaryCard
            title="Absent"
            value={summary.absent}
          />

          <SummaryCard
            title="Half Day"
            value={summary.halfDay}
          />

          <SummaryCard
            title="Overtime Hours"
            value={summary.overtime}
          />

          <SummaryCard
            title="Fine Hours"
            value={summary.fine}
          />

          <SummaryCard
            title="Leave"
            value={summary.leave}
          />

          <SummaryCard
            title="Punched In"
            value={summary.punchedIn}
          />

          <SummaryCard
            title="Punched Out"
            value={summary.punchedOut}
          />

        </div>

        <div className="quick-actions">

          <div className="action-card">
            <div className="action-icon">➕</div>
            Bulk Add Attendance
          </div>

          <div className="action-card">
            <div className="action-icon">📅</div>
            Leaves
          </div>

          <div className="action-card">
            <div className="action-icon">🚗</div>
            On Duty
          </div>

          <div className="action-card">
            <div className="action-icon">📝</div>
            Bulk Add Work
          </div>

          <div className="action-card">
            <div className="action-icon">⚠️</div>
            Fine
          </div>

          <div className="action-card">
            <div className="action-icon">⏱️</div>
            Overtime
          </div>

        </div>

        <div className="attendance-panel">

          <div className="panel-header">

            <div className="panel-title">
              Staff Attendance
            </div>

            <div className="panel-controls">

              <input
                className="search-box"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="select-box"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All</option>
                <option>Present</option>
                <option>Absent</option>
                <option>Half Day</option>
                <option>Leave</option>
              </select>

            </div>

          </div>

          <div className="staff-list">

            {filteredStaff.map((staff) => {

              const status = statusInfo[staff.status] || {
                label: staff.status,
                className: "",
              };

              return (
                <div className="staff-row" key={staff.id}>

                  <div className="staff-info">
                    <div className="staff-name">
                      {staff.name}
                    </div>

                    <div className="staff-code">
                      {staff.code}
                    </div>
                  </div>

                  <div className="attendance-details">

                    <div className="hours">
                      Hrs
                      <br />
                      <strong>{staff.hours}</strong>
                    </div>

                    <div className={`status ${status.className}`}>
                      {staff.status} | {status.label}
                    </div>

                    <div className="time-info">
                      {staff.inTime ? (
                        <>
                          {staff.inTime} - {staff.outTime}
                        </>
                      ) : (
                        "No Punch"
                      )}
                    </div>

                    <div className="note-area">

                      {showNoteFor === staff.id ? (
                        <>
                          <input
                            className="note-input"
                            placeholder="Add Note"
                            value={notes[staff.id] || ""}
                            onChange={(e) =>
                              setNotes({
                                ...notes,
                                [staff.id]: e.target.value,
                              })
                            }
                          />

                          <button
                            className="primary-btn"
                            onClick={() => saveNote(staff.id)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary-btn"
                          onClick={() => setShowNoteFor(staff.id)}
                        >
                          Add Note
                        </button>
                      )}

                    </div>

                  </div>

                </div>
              );
            })}

          </div>

          <div className="legend">
            <div className="legend-item">
              <strong>P</strong> = Present
            </div>

            <div className="legend-item">
              <strong>HD</strong> = Half Day
            </div>

            <div className="legend-item">
              <strong>A</strong> = Absent
            </div>

            <div className="legend-item">
              <strong>F</strong> = Fine
            </div>

            <div className="legend-item">
              <strong>OT</strong> = Overtime
            </div>

            <div className="legend-item">
              <strong>L</strong> = Leave
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="summary-card">
      <div className="summary-label">
        {title}
      </div>

      <div className="summary-value">
        {value}
      </div>
    </div>
  );
}
