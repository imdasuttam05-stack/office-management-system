import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";

function range(month, year) { return { start:new Date(Date.UTC(year,month-1,1)), end:new Date(Date.UTC(year,month,1)) }; }

export async function payrollApprovals(req,res){
  const month=Number(req.query.month)||new Date().getMonth()+1;
  const year=Number(req.query.year)||new Date().getFullYear();
  const {start,end}=range(month,year);
  const rows=await Attendance.find({date:{$gte:start,$lt:end},$or:[{overtimeHours:{$gt:0}},{cuttingMinutes:{$gt:0}}]})
    .populate("employeeId","employeeCode name department designation workLocation")
    .populate("shiftId","name startTime endTime breakMinutes")
    .sort({date:1});
  res.json({success:true,approvals:rows});
}

export async function approvePayrollAdjustments(req,res){
  const ids=Array.isArray(req.body.ids)?req.body.ids:[];
  if(!ids.length) return res.status(400).json({success:false,message:"Select at least one record."});
  const overtimeApproved=Boolean(req.body.overtimeApproved);
  const cuttingApproved=Boolean(req.body.cuttingApproved);
  const now=new Date();
  const update={};
  if (req.body.overtimeApproved !== undefined) { update.overtimeApproved=overtimeApproved; update.overtimeApprovedBy=overtimeApproved?(req.user?._id||null):null; update.overtimeApprovedAt=overtimeApproved?now:null; }
  if (req.body.cuttingApproved !== undefined) { update.cuttingApproved=cuttingApproved; update.cuttingApprovedBy=cuttingApproved?(req.user?._id||null):null; update.cuttingApprovedAt=cuttingApproved?now:null; }
  const result=await Attendance.updateMany({_id:{$in:ids}},{$set:update});
  res.json({success:true,message:`${result.modifiedCount} attendance adjustment(s) updated.`});
}
