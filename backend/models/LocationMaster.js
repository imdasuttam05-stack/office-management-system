import mongoose from "mongoose";
const schema = new mongoose.Schema({
  companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",default:null,index:true},
  name:{type:String,required:true,trim:true,maxlength:120},
  code:{type:String,trim:true,uppercase:true,maxlength:30,default:""},
  address:{type:String,trim:true,maxlength:500,default:""},
  active:{type:Boolean,default:true,index:true},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true});
schema.index({companyId:1,name:1},{unique:true});
export default mongoose.model("LocationMaster",schema);
