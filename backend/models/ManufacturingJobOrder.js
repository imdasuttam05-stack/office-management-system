import mongoose from "mongoose";
const line = new mongoose.Schema({
  stockId:{type:mongoose.Schema.Types.ObjectId,ref:"InventoryStock",default:null},
  itemName:{type:String,required:true,trim:true}, unit:{type:String,default:"KG"}, qty:{type:Number,required:true,min:0}, rate:{type:Number,default:0,min:0}, value:{type:Number,default:0,min:0}, hsn:{type:String,default:""}, batchNo:{type:String,default:""}, barcode:{type:String,default:""}
},{_id:false});
const schema=new mongoose.Schema({
 jobNo:{type:String,unique:true,index:true}, companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",default:null,index:true}, date:{type:Date,default:Date.now,index:true}, type:{type:String,enum:["GRADING","FINISHED_GOODS"],required:true,index:true}, location:{type:String,required:true,index:true}, sourceItems:{type:[line],default:[]}, outputItems:{type:[line],default:[]}, labourCost:{type:Number,default:0,min:0}, transportCost:{type:Number,default:0,min:0}, otherCost:{type:Number,default:0,min:0}, totalCost:{type:Number,default:0,min:0}, notes:{type:String,default:""}, status:{type:String,enum:["POSTED","CANCELLED"],default:"POSTED",index:true}, createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true});
schema.index({type:1,date:-1,location:1});
export default mongoose.model("ManufacturingJobOrder",schema);
