from django.shortcuts import render

from .models import Component
from .serializers import ComponentSerializer
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def hello_world(request):
    return Response({"message": "Hello from DRF!"})

class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")

        if not username or not password:
            return Response({"error": "Username and password required"},
                            status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"},
                            status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            username=username,
            email=email,
            password=make_password(password)
        )
        return Response({"message": "User registered successfully", "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }},
         status=status.HTTP_201_CREATED)

class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]

class MyTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class ComponentListView(generics.ListAPIView):

    queryset = Component.objects.all()
    serializer_class = ComponentSerializer
    permission_classes = [AllowAny] 

    
    ordering_fields = ['s_no', 'name', 'legend']
    ordering = ['s_no']  
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        return queryset

class ComponentDetailView(generics.RetrieveAPIView):
    queryset = Component.objects.all()
    serializer_class = ComponentSerializer
    permission_classes = [AllowAny]
    lookup_field = 'id'

class ComponentByNameView(generics.RetrieveAPIView):
    queryset = Component.objects.all()
    serializer_class = ComponentSerializer
    permission_classes = [AllowAny]
    lookup_field = 'name'
