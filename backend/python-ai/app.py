from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ocr import extract_expense_data


app = FastAPI(title="Office Management OCR API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "OCR service is running"
    }


@app.post("/api/ocr/expense")
async def scan_expense(
    file: UploadFile = File(...)
):

    if not file:
        raise HTTPException(
            status_code=400,
            detail="No file uploaded"
        )

    allowed_types = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG or WEBP images are supported"
        )

    try:
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        result = extract_expense_data(image_bytes)

        return {
            "success": True,
            "filename": file.filename,
            "data": result
        }

    except HTTPException:
        raise

    except Exception as error:
        print("OCR ERROR:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to process image"
        )
