FROM debian:bookworm-20260713-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818

ARG DEBIAN_SNAPSHOT=20260818T000000Z

RUN printf '%s\n' \
	"deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}/ bookworm main" \
	"deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT}/ bookworm-security main" \
	> /etc/apt/sources.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends \
		fontconfig=2.14.1-4 \
		fonts-crosextra-caladea=20200211-1 \
		fonts-crosextra-carlito=20220224-1 \
		fonts-liberation2=2.1.5-1 \
		libreoffice-writer=4:7.4.7-1+deb12u14 \
	&& rm -rf /var/lib/apt/lists/*

COPY fonts.conf /etc/fonts/local.conf

RUN fc-cache -f \
	&& soffice --headless --version

ENV HOME=/tmp
ENV LANG=C.UTF-8

WORKDIR /vercel/sandbox
