import mongoose from "mongoose";
const schema=new mongoose.Schema({
 companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",default:null,index:true},sourceType:{type:String,enum:["PURCHASE","SALE"],required:true,index:true},sourceId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},documentNo:{type:String,required:true,index:true},date:{type:Date,required:true,index:true},partyName:{type:String,default:""},partyGSTIN:{type:String,default:""},location:{type:String,default:""},hsn:{type:String,default:""},taxableAmount:{type:Number,default:0},cgst:{type:Number,default:0},sgst:{type:Number,default:0},igst:{type:Number,default:0},gstRate:{type:Number,default:0},supplyType:{type:String,default:""}},{timestamps:true});
schema.index({sourceType:1,date:-1});
export default mongoose.model("GstLedger",schema);
