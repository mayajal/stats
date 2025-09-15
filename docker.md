To build a Docker image for your Python script using Docker Desktop, follow these steps:

# 1. Prepare Your Python Script
Ensure your Python script is in a directory. For example:

/my-python-app/
    ├── app.py
# 2. Create a Dockerfile
Inside the same directory as your Python script, create a file named Dockerfile with the following content:

# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container
COPY . /app

# Install any dependencies (if you have a requirements.txt file)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Command to run your Python script
CMD ["python", "app.py"]
If your script doesn't have dependencies, you can skip the COPY requirements.txt and RUN pip install lines.

# 3. Build the Docker Image
Open a terminal, navigate to the directory containing your Dockerfile, and run the following command:

<docker build -t my-python-app .>

-t my-python-app: Tags the image with the name my-python-app.
.: Specifies the current directory as the build context.

# 4. Run the Docker Image
Once the image is built, you can run it as a container:

<docker run --rm my-python-app>

--rm: Automatically removes the container after it stops.

# 5. Verify in Docker Desktop
You can open Docker Desktop to see the built image under the Images tab and manage it from there.

## Run the container
To keep the container running and visible in Docker Desktop

<docker run -d -p 8080:8080 rbd-service:latest> 

Explanation:
-d: Runs the container in detached mode (in the background).
-p 8080:8080: Maps port 8080 on your host to port 8080 in the container, allowing you to access the application at http://localhost:8080⁠.


## To stop a running Docker container, follow these steps:

1. List Running Containers
First, identify the container you want to stop by listing all running containers:

docker ps
This will display a list of running containers, including their CONTAINER ID, IMAGE, NAME, and other details.

2. Stop the Container
Once you have the CONTAINER ID or NAME of the container, stop it using the following command:

docker stop <container_id_or_name>
For example:

docker stop abc123def456

3. Verify the Container is Stopped
Run the following command to ensure the container is no longer running:

docker ps
If the container is stopped, it will no longer appear in the list of running containers.

4. Force Stop (Optional)
If the container does not stop gracefully, you can force stop it using:

docker kill <container_id_or_name>
This will immediately terminate the container.



-----------
# Check which process is using port 8080.

<lsof -i:8080>

# List running docker containers

<docker ps>

# Stop the Docker container

<docker stop -container_id->


docker build -t rbd-service .
docker run -d -p 8080:8080 rbd-service:latest

docker build -t tranx-service .

docker run -d -p 8080:8080 tranx-service:latest python3 tranx.py


docker build -t slide-service .
docker run -d -p 9006:9006 slide-service:latest

docker build -t nonp-service .
docker run -d -p 8080:8080 nonp-service:latest

docker build -t probit-service .
docker run -d -p 8080:8080 probit-service:latest

docker build -t survival-service .
docker run -d -p 8080:8080 survival-service:latest

docker build -t lmm-service .
docker run -d -p 8080:8080 lmm-service:latest

docker build -t blup-service .
docker run -d -p 8080:8080 blup-service:latest

docker build -t alpha-service .
docker run -d -p 8080:8080 alpha-service:latest


