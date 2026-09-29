import React from "react";
import Salary from "./Salary.jsx";

// Payroll is kept as a compatibility route.
// Salary is the single HR payroll screen so both /payroll and /salary
// use the same API and calculation flow.
export default function Payroll() {
  return <Salary />;
}
