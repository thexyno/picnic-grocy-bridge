{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.yarn
    pkgs.jre

    # keep this line if you use bash
    pkgs.bashInteractive
  ];
}
