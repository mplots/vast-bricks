# BrickSync Test Container

This is a testing-only BrickSync image. It leaves `vb-bricksync/Dockerfile` unchanged and runs BrickSync with stdin connected to a named FIFO. The test entrypoint is embedded in the Dockerfile, so the image has a single-file build context.

## Build

```sh
docker build -t vastbricks.com/bricksync:latest .
```

## Run

Mount a data directory that already contains `bricksync.conf.txt` and the matching BrickSync state files. For this repo, use the downloaded `.bricksync-data/data-back/` directory.

```sh
mkdir -p /tmp/vb-bricksync-test/control

docker run -d \
  --name bricksync \
  --cpus=".1" \
  -v "/home/ubuntu/bricksync/data:/opt/bricksync/data" \
  -v /home/ubuntu/bricksync/control:/opt/bricksync/control \
  vastbricks.com/bricksync:latest
```
sudo docker run -d  -v /home/ubuntu/bricksync/data:/opt/bricksync/data --name bricksync vastbricks.com/bricksync:latest
## Send Commands

Send a command from inside the container:

```sh
docker exec bricksync sh -c "printf '%s\n' 'help' > /opt/bricksync/control/commands.fifo"
```

On a Linux host with the control directory bind-mounted, you can also write to the FIFO directly:

```sh
printf '%s\n' 'help' > /tmp/vb-bricksync-test/control/commands.fifo
```

Replace `help` with the BrickSync command you want to test.

## View Output

```sh
docker logs -f vb-bricksync-test
```

## Clean Up

```sh
docker stop vb-bricksync-test
docker rm vb-bricksync-test
```
