import mongoose from "mongoose";
import companyScopePlugin from "./companyScopePlugin.js";
const line=new mongoose.Schema({itemName:{type:String,required:true},unit:{type:String,default:"KG"},qty:{type:Number,required:true,min:0},rate:{type:Number,default:0,min:0},value:{type:Number,default:0,min:0},batchNo:{type:String,default:""},barcode:{type:String,default:""}},{_id:false});
const schema=new mongoose.Schema({productionNo:{type:String,index:true},jobId:{type:mongoose.Schema.Types.ObjectId,ref:"ManufacturingJobOrder",required:true,index:true},jobNo:{type:String,index:true},companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",default:null,index:true},date:{type:Date,default:Date.now,index:true},location:{type:String,required:true},outputItems:{type:[line],default:[]},notes:{type:String,default:""},status:{type:String,enum:["POSTED","CANCELLED"],default:"POSTED",index:true},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}},{timestamps:true});
schema.index({jobId:1,date:-1}); schema.index({ companyId: 1, financialYear: 1, productionNo: 1 }, { unique: true });
schema.plugin(companyScopePlugin, { financialYear: true });
export default mongoose.model("ProductionEntry",schema);
