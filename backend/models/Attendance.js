import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true
    },

    date: {
      type: Date,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Half Day",
        "Leave",
        "Holiday",
        "Week Off"
      ],
      required: true
    },

    /* =====================================================
       ATTENDANCE TIME
       ===================================================== */

    checkIn: {
      type: String,
      default: ""
    },

    checkOut: {
      type: String,
      default: ""
    },


    /* =====================================================
       WORK LOCATION
       ===================================================== */

    workLocation: {
      type: String,
      trim: true,
      default: ""
    },


    /* =====================================================
       SHIFT
       ===================================================== */

    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null
    },

    shiftName: {
      type: String,
      trim: true,
      default: ""
    },


    /* =====================================================
       OVERTIME
       ===================================================== */

    /*
      Example:
      8 minutes OT = 0.13 hours

      Backend stores decimal hours because
      salary calculation uses hours × OT rate.
    */

    overtimeHours: {
      type: Number,
      default: 0,
      min: 0
    },

    /*
      OT must be approved before it is paid.
    */

    overtimeApproved: {
      type: Boolean,
      default: false
    },

    overtimeApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    overtimeApprovedAt: {
      type: Date,
      default: null
    },


    /* =====================================================
       CUTTING / SHORT HOURS
       ===================================================== */

    /*
      Cutting is stored in minutes.

      Example:
      1 hour 20 minutes = 80 minutes
    */

    cuttingMinutes: {
      type: Number,
      default: 0,
      min: 0
    },

    /*
      Cutting must be approved before
      it is deducted from salary.
    */

    cuttingApproved: {
      type: Boolean,
      default: false
    },

    cuttingApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    cuttingApprovedAt: {
      type: Date,
      default: null
    },


    /* =====================================================
       NOTE
       ===================================================== */

    note: {
      type: String,
      default: ""
    }
  },

  {
    timestamps: true
  }
);


/* =========================================================
   UNIQUE ATTENDANCE
   =========================================================

   One employee can have only one attendance
   record for one date.
*/

schema.index(
  {
    employeeId: 1,
    date: 1
  },
  {
    unique: true
  }
);


export default mongoose.model(
  "Attendance",
  schema
);
