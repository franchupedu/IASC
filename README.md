# IASC
Grupo 1 <br />
<br />
#Comandos Docker<br />
Caso de Error "Got permission denied": sudo chmod 666 /var/run/docker.sock<br />
Levantar el Swarm (Loadbalancer y nodos de la App): docker stack deploy -c docker-compose.yml swarmnodeapp<br />
Actualizar las imagenes de Docker: <br />
  docker image build -t matiasberardi/iasc<br />
  docker image push matiasberardi/iasc<br />
