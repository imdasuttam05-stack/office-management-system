import mongoose from "mongoose";
const schema = new mongoose.Schema({
  companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",default:null,index:true},
  name:{type:String,required:true,trim:true,maxlength:180},
  itemType:{type:String,enum:["RAW_MATERIAL","GRADE","FINISHED_GOODS"],default:"RAW_MATERIAL",index:true},
  hsn:{type:String,trim:true,default:"",maxlength:30},
  unit:{type:String,trim:true,default:"KG",maxlength:30},
  defaultGstRate:{type:Number,min:0,max:100,default:0},
  defaultBarcode:{type:String,trim:true,default:"",maxlength:120},
  active:{type:Boolean,default:true,index:true},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true});
schema.index({companyId:1,itemType:1,name:1},{unique:true});
export default mongoose.model("InventoryItemMaster",schema);
