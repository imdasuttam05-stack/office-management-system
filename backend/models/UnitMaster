import mongoose from "mongoose";

const schema = new mongoose.Schema({
  companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",default:null,index:true},
  name:{type:String,required:true,trim:true,maxlength:80},
  code:{type:String,required:true,trim:true,uppercase:true,maxlength:20},
  decimalPlaces:{type:Number,min:0,max:6,default:2},
  active:{type:Boolean,default:true,index:true},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true});

schema.index({companyId:1,code:1},{unique:true});
schema.index({companyId:1,name:1},{unique:true});

export default mongoose.model("UnitMaster",schema);
