# from pydantic import BaseModel, EmailStr
#
# class UserRegister(BaseModel):
#     username: str
#     email: EmailStr
#     password: str
#
# class UserLogin(BaseModel):
#     email: str
#     password: str
#
# class TokenResponse(BaseModel):
#     access_token: str
#     token_type: str = 'bearer'




from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=72
    )

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict