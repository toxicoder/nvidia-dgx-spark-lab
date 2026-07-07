# Spark Lab Kasm desktop with preinstalled Hermes workspace-dev assistant.
# Build on Spark node (where Kasm agent runs):
#   docker build -t spark-lab-kasm-desktop:1.19.0 -f k8s/dev/images/kasm-spark-desktop/Dockerfile .

ARG KASM_VERSION=1.19.0
FROM kasmweb/core-ubuntu-focal:${KASM_VERSION}-rolling-weekly AS kasm-base

FROM nousresearch/hermes-agent:latest AS hermes-install
USER root

FROM kasm-base
USER root

ENV HOME=/home/kasm-default-profile
ENV STARTUPDIR=/dockerstartup
ENV INST_SCRIPTS=$STARTUPDIR/install
WORKDIR $HOME

######### Customize Container Here ###########

COPY --from=hermes-install /opt/hermes /opt/hermes

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

COPY hermes/profiles/workspace-dev /opt/spark-lab/hermes-seed
COPY k8s/dev/images/kasm-spark-desktop/custom_startup.sh /opt/spark-lab/custom_startup.sh
RUN chmod +x /opt/spark-lab/custom_startup.sh

RUN mkdir -p $HOME/Desktop \
    && cat >$HOME/Desktop/hermes-dashboard.desktop <<'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Hermes Dev Assistant
Comment=Spark Lab coding assistant dashboard
Exec=xdg-open http://127.0.0.1:9119
Icon=utilities-terminal
Terminal=false
Categories=Development;
EOF
    && chmod +x $HOME/Desktop/hermes-dashboard.desktop \
    && chown 1000:1000 $HOME/Desktop/hermes-dashboard.desktop

RUN cat >$HOME/Desktop/hermes-cli.desktop <<'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Hermes CLI
Comment=Interactive Hermes coding assistant
Exec=xfce4-terminal --command=/opt/hermes/.venv/bin/hermes
Icon=utilities-terminal
Terminal=false
Categories=Development;
EOF
    && chmod +x $HOME/Desktop/hermes-cli.desktop \
    && chown 1000:1000 $HOME/Desktop/hermes-cli.desktop

RUN echo "/opt/spark-lab/custom_startup.sh &" > $STARTUPDIR/custom_startup.sh \
    && chmod +x $STARTUPDIR/custom_startup.sh

######### End Customizations ###########

RUN chown 1000:0 $HOME
RUN $STARTUPDIR/set_user_permission.sh $HOME

ENV HOME=/home/kasm-user
WORKDIR $HOME
RUN mkdir -p $HOME && chown -R 1000:0 $HOME

USER 1000