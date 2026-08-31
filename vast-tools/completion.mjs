import { managedServices } from "./service-registry.mjs";

export const completionLoadedEnvName = "VAST_COMPLETION_LOADED";

export default function completions() {
  const commands = "test t services svc ps logs completion help";
  const serviceActions = "list start stop restart";
  const serviceNames = managedServices.map(({ name }) => name).join(" ");
  const startOptions = "--skip-build -sb --help -h";
  const restartOptions = "--skip-build -sb --clean-db --help -h";
  const testOptions = "--build -b --clean-build -cb --help -h";
  const logsOptions = "--follow -f --tail -t --help -h";
  const basicOptions = "--help -h";

  return `# This output is equivalent to vast-tools/completion.bash.
# Prefer sourcing that file from shell startup so opening a shell does not need Node.

_vast_completion() {
  local current previous command service_action
  current="\${COMP_WORDS[COMP_CWORD]}"
  previous="\${COMP_WORDS[COMP_CWORD-1]}"
  command="\${COMP_WORDS[1]}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "${commands}" -- "\${current}"))
    return
  fi

  case "\${command}" in
    services|svc)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=($(compgen -W "${serviceActions}" -- "\${current}"))
        return
      fi

      service_action="\${COMP_WORDS[2]}"
      case "\${service_action}" in
        start)
          if [[ "\${current}" == -* ]]; then
            COMPREPLY=($(compgen -W "${startOptions}" -- "\${current}"))
          else
            COMPREPLY=($(compgen -W "${serviceNames}" -- "\${current}"))
          fi
          return
          ;;
        restart)
          if [[ "\${current}" == -* ]]; then
            COMPREPLY=($(compgen -W "${restartOptions}" -- "\${current}"))
          else
            COMPREPLY=($(compgen -W "${serviceNames}" -- "\${current}"))
          fi
          return
          ;;
        list|stop)
          if [[ "\${current}" == -* ]]; then
            COMPREPLY=($(compgen -W "${basicOptions}" -- "\${current}"))
          else
            COMPREPLY=($(compgen -W "${serviceNames}" -- "\${current}"))
          fi
          return
          ;;
      esac
      ;;
    ps)
      if [[ "\${current}" == -* ]]; then
        COMPREPLY=($(compgen -W "${basicOptions}" -- "\${current}"))
      else
        COMPREPLY=($(compgen -W "${serviceNames}" -- "\${current}"))
      fi
      return
      ;;
    logs)
      case "\${previous}" in
        --tail|-t)
          COMPREPLY=()
          return
          ;;
      esac
      if [[ "\${COMP_WORDS[2]}" == "clear" ]]; then
        if [[ "\${current}" == -* ]]; then
          COMPREPLY=($(compgen -W "${basicOptions}" -- "\${current}"))
        else
          COMPREPLY=($(compgen -W "${serviceNames}" -- "\${current}"))
        fi
      elif [[ "\${current}" == -* ]]; then
        COMPREPLY=($(compgen -W "${logsOptions}" -- "\${current}"))
      elif [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=($(compgen -W "clear ${serviceNames}" -- "\${current}"))
      else
        COMPREPLY=()
      fi
      return
      ;;
    completion|help)
      COMPREPLY=()
      return
      ;;
    test|t)
      if [[ "\${current}" == -* ]]; then
        COMPREPLY=($(compgen -W "${testOptions}" -- "\${current}"))
      else
        COMPREPLY=()
      fi
      return
      ;;
  esac

  COMPREPLY=($(compgen -W "${commands}" -- "\${current}"))
}

complete -F _vast_completion vast
export ${completionLoadedEnvName}=1`;
}
