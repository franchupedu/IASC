# IASC
Grupo 1

#Comandos Docker
Caso de Error "Got permission denied": sudo chmod 666 /var/run/docker.sock
Levantar el Swarm (Loadbalancer y nodos de la App): docker stack deploy -c docker-compose.yml swarmnodeapp
Actualizar las imagenes de Docker: 
  docker image build -t matiasberardi/iasc
  docker image push matiasberardi/iasc
