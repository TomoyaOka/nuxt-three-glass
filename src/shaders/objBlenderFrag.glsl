precision mediump float;
#include <common>
#include <lights_pars_begin>

varying float vNoise;
uniform vec3 uColor;

// varying vec3 vNormal;
varying vec3 worldNormal;
varying vec3 eyeVector;
uniform vec2 winResolution;
uniform sampler2D uTexture;


void main() {
  float iorRatio = 1.0/1.20;
  vec2 uv = gl_FragCoord.xy / winResolution.xy;
  vec3 normal = worldNormal;
  vec3 refractVec = refract(eyeVector, normal, iorRatio);
  vec4 color = texture2D(uTexture, uv + refractVec.xy);


  gl_FragColor = color;
}


