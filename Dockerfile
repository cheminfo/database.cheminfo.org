FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM joseluisq/static-web-server:2-alpine
# The build is served as it was written; the entrypoint copies it to /public
# only when it has an analytics snippet to inject into every page.
COPY --from=builder /app/dist /public-src
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENV SERVER_ROOT=/public-src
# No fallback page: the build writes a real index.html for every address the
# tool answers, each with its own title and canonical link. An address that is
# not on disk is not a page of this site, and 404s instead of serving the
# playground under a name it does not have.
#
# `/cheatsheet` is served directly rather than redirected to `/cheatsheet/`:
# that is the address every shared link and every canonical carries, and a
# crawler must not have to follow a 308 to reach the page that names it.
ENV SERVER_REDIRECT_TRAILING_SLASH=false
ENV SERVER_PORT=80
# A /health endpoint that answers 200 and writes no access-log line, which is
# what the compose healthcheck and the server's deploy script probe.
ENV SERVER_HEALTH=true
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["static-web-server"]
