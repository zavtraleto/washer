in vec3 position;
in vec3 normal;
in vec2 uv;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;

out vec2 vUv;
out vec3 vNormal;
out vec3 vViewDirection;

void main() {
  vUv = uv;

  // World normal
  vNormal = normalize(normalMatrix * normal);

  // View direction from surface to camera
  vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vViewDirection = normalize(cameraPosition - worldPosition);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
