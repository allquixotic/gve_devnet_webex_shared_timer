# Use an official Python runtime as a parent image
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Set the working directory to /app
WORKDIR /app

# Install build dependencies
RUN dnf update && dnf install -y unzip tar gzip wget && dnf clean all

# Copy the current directory contents into the container at /app
COPY . /app

# Install bun and JS dependencies
RUN curl -fsSL https://bun.sh/install | bash
#Put bun on PATH
RUN export BUN_INSTALL=$HOME/.bun && export PATH=$BUN_INSTALL/bin:$PATH && echo "export BUN_INSTALL=$HOME/.bun" >> $HOME/.bashrc && echo "export PATH=$BUN_INSTALL/bin:$PATH" >> $HOME/.bashrc && bun install

# Make port 9001 available to the world outside this container
EXPOSE 9001

# Run app.py when the container launches
CMD ["/root/.bun/bin/bun", "run", "app.ts"]
