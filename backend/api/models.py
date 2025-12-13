from django.db import models

class Project(models.Model):
    name = models.CharField(max_length=100)
    user_id = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Component(models.Model):
    s_no = models.CharField(max_length=10)
    parent = models.CharField(max_length=100)
    name = models.CharField(max_length=100)
    legend = models.CharField(max_length=100)
    suffix = models.CharField(max_length=10)
    object = models.CharField(max_length=100)
    svg = models.ImageField(upload_to='components/')
    png = models.ImageField(upload_to='components/')
    grips = models.TextField()
